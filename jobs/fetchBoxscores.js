if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const getGames = require("./getGames");
const {
  liveFeedUrl,
  convertMMSStoSec,
  validateInputArgs,
  getApiData,
  logBatch,
} = require("./fetchHelpers");
const createPlayers = require("./createPlayers");
const getPlayers = require("./getPlayers");

const prisma = new PrismaClient();

const getPlayerCurrentTeam = (player) => {
  const currentTeam = player.teams.filter((team) => !team.endDate);
  if (currentTeam.length > 1) {
    throw new Error(
      `getPlayerCurrentTeam - Player ${player.id} has more than 1 teams with endDate null`
    );
  }

  return currentTeam[0];
};

const updatePlayerTeam = async (player, prevTeam, newTeam) => {
  const updatePrevTeam = prisma.playerTeam.update({
    where: { id: prevTeam.id },
    data: {
      endDate: game.apiDate,
    },
  });

  const createNewTeam = prisma.playerTeam.create({
    data: {
      startDate: game.apiDate,
      player: { connect: { id: player.id } },
      team: { connect: { id: newTeam.id } },
    },
  });

  await prisma.$transaction([updatePrevTeam, createNewTeam]);
};

const createBoxscoreObject = (game, player, team, stats, isGoalie) => {
  isGoalie ? (stats = stats.goalieStats) : (stats = stats.skaterStats);

  const baseScore = {
    gamePk: game.gamePk,
    timeOnIce: convertMMSStoSec(stats.timeOnIce),
    assists: stats.assists,
    goals: stats.goals,
    player: {
      connect: { id: player.id },
    },
    team: {
      connect: { id: team.id },
    },
    game: {
      connect: { id: game.id },
    },
  };

  if (isGoalie) {
    return {
      ...baseScore,
      saves: stats.saves,
      powerPlaySaves: stats.powerPlaySaves,
      shortHandedSaves: stats.shortHandedSaves,
      evenSaves: stats.evenSaves,
      shortHandedShotsAgainst: stats.shortHandedShotsAgainst,
      powerPlayShotsAgainst: stats.powerPlayShotsAgainst,
      ...(stats.decision && { decision: stats.decision }),
      shotsAgainst: stats.shots,
      penaltyMinutes: stats.pim ? stats.pim : 0,
      savePct: stats.savePercentage || 0,
      evenSavePct: stats.evenStrengthSavePercentage,
      powerPlaySavePct: stats.powerPlaySavePercentage,
      shortHandedSavePct: stats.shortHandedSavePercentage,
    };
  } else {
    // Sometimes from API shots are 0 even if player has scored.
    // This causes zero division error in the best players aggregation pipeline.
    if (stats.goals && !stats.shots) stats.shots = 1;
    return {
      ...baseScore,
      penaltyMinutes: stats.penaltyMinutes ? stats.penaltyMinutes : 0,
      points: stats.assists + stats.goals,
      shots: stats.shots,
      hits: stats.hits,
      powerPlayGoals: stats.powerPlayGoals,
      powerPlayAssists: stats.powerPlayAssists,
      penaltyMinutes: stats.penaltyMinutes,
      faceOffsTaken: stats.faceoffTaken,
      faceOffWins: stats.faceOffWins,
      takeaways: stats.takeaways,
      giveaways: stats.giveaways,
      shortHandedGoals: stats.shortHandedGoals,
      shortHandedAssists: stats.shortHandedAssists,
      blocked: stats.blocked,
      plusMinus: stats.plusMinus,
      evenTimeOnIce: convertMMSStoSec(stats.evenTimeOnIce),
      powerPlayTimeOnIce: convertMMSStoSec(stats.powerPlayTimeOnIce),
      shortHandedTimeOnIce: convertMMSStoSec(stats.shortHandedTimeOnIce),
    };
  }
};

const createBoxscorePromise = (fetchedPlayers, game, player, team) => {
  let { stats } = fetchedPlayers[`ID${player.playerIdApi}`];
  const isGoalie = player.primaryPosition === "G";
  const scoreObject = createBoxscoreObject(game, player, team, stats, isGoalie);
  if (isGoalie) {
    return prisma.goalieBoxscore.create({ data: scoreObject });
  } else {
    return prisma.skaterBoxscore.create({ data: scoreObject });
  }
};

const fetchBoxscores = async ({ fetchMode, inputArg }) => {
  const games = await getGames({
    fetchMode,
    inputArg,
    flags: { boxscoresFetched: false },
  });

  logBatch("fetchBoxscores", games);

  for (const game of games) {
    try {
      if (fetchMode === "GAMEPK") {
        await prisma.skaterBoxscore.deleteMany({
          where: { gamePk: game.gamePk },
        });
        await prisma.goalieBoxscore.deleteMany({
          where: { gamePk: game.gamePk },
        });
      }

      const url = liveFeedUrl(game.gamePk);
      console.log(`fetchBoxscores - url: ${url}`);
      const {
        data: {
          liveData: {
            boxscore: { teams },
          },
        },
      } = await getApiData(url);

      const players = await getPlayers(teams);
      if (players.notInDb.away.length) {
        await createPlayers(
          players.notInDb.away,
          game.gamePk,
          teams.away.team.id
        );
      }
      if (players.notInDb.home.length) {
        await createPlayers(
          players.notInDb.home,
          game.gamePk,
          teams.home.team.id
        );
      }
      const awayTeam = await prisma.team.findUnique({
        where: {
          teamIdApi: teams.away.team.id,
        },
      });
      const homeTeam = await prisma.team.findUnique({
        where: {
          teamIdApi: teams.home.team.id,
        },
      });

      console.log(
        "fetchBoxscores - Checking if there are player teams to update..."
      );
      // Check that the current team of the player matches to the API data.
      // If not, update the player to match the API.
      const playersInDbAway = await prisma.player.findMany({
        where: {
          playerIdApi: { in: [...players.inDb.away, ...players.notInDb.away] },
        },
        include: {
          teams: {
            include: { team: true },
          },
        },
      });

      for (const player of playersInDbAway) {
        const currentTeam = getPlayerCurrentTeam(player);
        if (currentTeam.team.id !== awayTeam.id) {
          updatePlayerTeam(player, currentTeam, awayTeam);
          console.log(
            `fetchBoxscores - Updated player ${player.id} team from ${currentTeam.team.id} to ${awayTeam.id} (AWAY)`
          );
        }
      }

      // Check also homeTeam players
      const playersInDbHome = await prisma.player.findMany({
        where: {
          playerIdApi: { in: [...players.inDb.home, ...players.notInDb.home] },
        },
        include: {
          teams: {
            include: { team: true },
          },
        },
      });
      for (const player of playersInDbHome) {
        const currentTeam = getPlayerCurrentTeam(player);
        if (currentTeam.team.id !== homeTeam.id) {
          updatePlayerTeam(player, currentTeam, homeTeam);
          console.log(
            `fetchBoxscores - Updated player ${player.id} team from ${currentTeam.team.id} to ${awayTeam.id} (HOME)`
          );
        }
      }

      const fetchedPlayers = { ...teams.home.players, ...teams.away.players };
      const promiseArray = [];
      for (const player of playersInDbAway) {
        promiseArray.push(
          createBoxscorePromise(fetchedPlayers, game, player, awayTeam)
        );
      }
      for (const player of playersInDbHome) {
        promiseArray.push(
          createBoxscorePromise(fetchedPlayers, game, player, homeTeam)
        );
      }

      console.log("fetchBoxscores - Saving boxscores");
      await prisma.$transaction(promiseArray);

      await prisma.game.update({
        where: { id: game.id },
        data: { boxscoresFetched: true },
      });
      console.log(`fetchBoxscores - Game ${game.gamePk} done`);
    } catch (err) {
      console.error(
        `fetchBoxscores - Error while working on ${game.gamePk}.\n${err.stack}`
      );
      continue;
    }
  }
};

if (require.main === module) {
  const inputArgs = validateInputArgs(process.argv);
  fetchBoxscores(inputArgs)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}

module.exports = fetchBoxscores;
