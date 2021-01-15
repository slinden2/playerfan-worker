if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const getGames = require("./getGames");
const {
  liveFeedUrl,
  convertMMSStoSec,
  validateInputArgs,
  getApiData,
} = require("./fetchHelpers");
const createPlayers = require("./createPlayers");
const getPlayers = require("./getPlayers");

const prisma = new PrismaClient();

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
      decision: stats.decision,
      shotsAgainst: stats.shots,
      penaltyMinutes: stats.pim ? stats.pim : 0,
      savePct: stats.savePercentage,
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
    flag: "boxscoresFetched",
  });

  const gamePks = games.map((g) => g.gamePk);
  console.log(`fetchBoxscores - Starting to fetch batch: ${gamePks}`);

  for (const game of games) {
    try {
      console.log(`fetchBoxscores - url: ${liveFeedUrl(game.gamePk)}`);
      const {
        data: {
          liveData: {
            boxscore: { teams },
          },
        },
      } = await getApiData("livefeed", game.gamePk);

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
          season_teamIdApi: {
            season: process.env.SEASON,
            teamIdApi: teams.away.team.id,
          },
        },
      });
      const homeTeam = await prisma.team.findUnique({
        where: {
          season_teamIdApi: {
            season: process.env.SEASON,
            teamIdApi: teams.home.team.id,
          },
        },
      });

      console.log(
        "fetchBoxscores - Checking if there are player teams to update..."
      );
      // Check that the currentTeam of the player matches to the API data.
      // If not, update the player to match the API.
      const playersInDbAway = await prisma.player.findMany({
        where: {
          playerIdApi: { in: [...players.inDb.away, ...players.notInDb.away] },
        },
      });

      for (const player of playersInDbAway) {
        if (player.teamId !== awayTeam.id) {
          await prisma.player.update({
            where: { id: player.id },
            data: {
              currentTeam: { connect: { id: awayTeam.id } },
            },
          });
          console.log(
            `fetchBoxscores - Updated player ${player.id} team from ${player.teamId} to ${awayTeam.id} (AWAY)`
          );
        }
      }
      // Check also homeTeam players
      const playersInDbHome = await prisma.player.findMany({
        where: {
          playerIdApi: { in: [...players.inDb.home, ...players.notInDb.home] },
        },
      });
      for (const player of playersInDbHome) {
        if (player.teamId !== homeTeam.id) {
          await prisma.player.update({
            where: { id: player.id },
            data: {
              currentTeam: { connect: { id: homeTeam.id } },
            },
          });
          console.log(
            `fetchBoxscores - Updated player ${player.id} team from ${player.teamId} to ${homeTeam.id} (HOME)`
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
      await Promise.all(promiseArray);

      console.log(`fetchBoxscores - Game ${game.gamePk} done`);
      await prisma.game.update({
        where: { id: game.id },
        data: { boxscoresFetched: true },
      });
    } catch (err) {
      console.error(
        `fetchBoxscores - Error while working on ${game.gamePk}.\n${err.stack}`
      );
      continue;
    }
  }
};

const inputArgs = validateInputArgs(process.argv);

if (require.main === module) {
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
