if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const getGames = require("./getGames");
const {
  isValidDate,
  liveFeedUrl,
  convertMMSStoSec,
} = require("./fetchHelpers");
const createPlayers = require("./createPlayers");
const getPlayers = require("./getPlayers");

const prisma = new PrismaClient();

const inputDate = process.argv[2];

// validate date string
if (inputDate) {
  isValidDate(inputDate);
}

const createBoxscoreObject = (game, player, stats, isGoalie) => {
  isGoalie ? (stats = stats.goalieStats) : (stats = stats.skaterStats);

  const baseScore = {
    gamePk: game.gamePk,
    timeOnIce: convertMMSStoSec(stats.timeOnIce),
    assists: stats.assists,
    goals: stats.goals,
    player: {
      connect: { id: player.id },
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

const fetchBoxscores = async (date) => {
  const games = await getGames(date);

  const scoreArray = await Promise.all(
    games.map((game) => axios.get(liveFeedUrl(game.gamePk)))
  );

  for (const { data } of scoreArray) {
    const {
      liveData: {
        boxscore: { teams },
      },
    } = data;

    const game = await prisma.game.findUnique({
      where: { gamePk: data.gamePk },
    });

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
      }
    }

    const fetchedPlayers = { ...teams.home.players, ...teams.away.players };

    const promiseArray = [];
    for (const player of [...playersInDbAway, ...playersInDbHome]) {
      let { stats } = fetchedPlayers[`ID${player.playerIdApi}`];
      const isGoalie = player.primaryPosition === "G";
      const scoreObject = createBoxscoreObject(game, player, stats, isGoalie);
      if (isGoalie) {
        promiseArray.push(prisma.goalieBoxscore.create({ data: scoreObject }));
      } else {
        promiseArray.push(prisma.skaterBoxscore.create({ data: scoreObject }));
      }
    }

    await Promise.all(promiseArray);
    await prisma.game.update({
      where: { id: game.id },
      data: { boxscoresFetched: true },
    });
  }
};

fetchBoxscores(inputDate)
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
