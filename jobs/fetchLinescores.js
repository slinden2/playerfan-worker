if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const getGames = require("./getGames");
const {
  isValidDate,
  getApiData,
  getPlayersWithoutScratches,
} = require("./fetchHelpers");

const prisma = new PrismaClient();

const inputDate = process.argv[2];

// validate date string
if (inputDate) {
  isValidDate(inputDate);
}

const getStat = (boxscore, team, stat) => {
  const skaters = getPlayersWithoutScratches(
    boxscore.teams[team].skaters,
    boxscore.teams[team].scratches
  );

  let accumulator = 0;
  for (const id of skaters) {
    accumulator +=
      boxscore.teams[team].players[`ID${id}`].stats.skaterStats[stat];
  }

  return accumulator;
};

const getLinescoreObject = (game, linescore, boxscore, isHomeGame) => {
  const homeWins =
    linescore.teams.away.goals < linescore.teams.home.goals ? true : false;
  const finalPeriod = linescore.currentPeriod;

  const thisTeam = isHomeGame ? "home" : "away";
  const otherTeam = isHomeGame ? "away" : "home";

  const teamId = isHomeGame ? game.homeTeam.id : game.awayTeam.id;
  const opponentId = isHomeGame ? game.awayTeam.id : game.homeTeam.id;
  const teamData = {
    team: {
      connect: {
        id: teamId,
      },
    },
    opponent: {
      connect: {
        id: opponentId,
      },
    },
    game: {
      connect: {
        id: game.id,
      },
    },
    gamePk: game.gamePk,
    isHomeGame,
    points: isHomeGame
      ? homeWins
        ? 2
        : finalPeriod > 3
        ? 1
        : 0
      : !homeWins
      ? 2
      : finalPeriod > 3
      ? 1
      : 0,
    win: isHomeGame ? homeWins : !homeWins,
    otWin: isHomeGame
      ? homeWins && finalPeriod === 4
      : !homeWins && finalPeriod === 4,
    shootOutWin: isHomeGame
      ? homeWins && finalPeriod === 5
      : !homeWins && finalPeriod === 5,
    loss: isHomeGame
      ? !homeWins && finalPeriod <= 3
      : homeWins && finalPeriod <= 3,
    ot: isHomeGame ? !homeWins && finalPeriod > 3 : homeWins && finalPeriod > 3,
    goalsFor: linescore.teams[thisTeam].goals,
    goalsAgainst: linescore.teams[otherTeam].goals,
    penaltyMinutes: boxscore.teams[thisTeam].teamStats.teamSkaterStats.pim,
    shotsFor: boxscore.teams[thisTeam].teamStats.teamSkaterStats.shots,
    shotsAgainst: boxscore.teams[otherTeam].teamStats.teamSkaterStats.shots,
    powerPlayGoals:
      boxscore.teams[thisTeam].teamStats.teamSkaterStats.powerPlayGoals,
    powerPlayGoalsAllowed:
      boxscore.teams[otherTeam].teamStats.teamSkaterStats.powerPlayGoals,
    powerPlayOpportunities:
      boxscore.teams[thisTeam].teamStats.teamSkaterStats.powerPlayOpportunities,
    powerPlayOpportunitiesAllowed:
      boxscore.teams[otherTeam].teamStats.teamSkaterStats
        .powerPlayOpportunities,
    faceOffsTaken: getStat(boxscore, thisTeam, "faceoffTaken"),
    faceOffWins: getStat(boxscore, thisTeam, "faceOffWins"),
    blocked: boxscore.teams[thisTeam].teamStats.teamSkaterStats.blocked,
    takeaways: boxscore.teams[thisTeam].teamStats.teamSkaterStats.takeaways,
    giveaways: boxscore.teams[thisTeam].teamStats.teamSkaterStats.giveaways,
    hitsFor: boxscore.teams[thisTeam].teamStats.teamSkaterStats.hits,
    hitsAgainst: boxscore.teams[otherTeam].teamStats.teamSkaterStats.hits,
  };

  return teamData;
};

const fetchLinescores = async (date) => {
  const games = await getGames(date);

  for (const game of games) {
    const {
      data: {
        liveData: { boxscore, linescore },
      },
    } = await getApiData("livefeed", game.gamePk);

    const awayData = getLinescoreObject(game, linescore, boxscore, false);
    const homeData = getLinescoreObject(game, linescore, boxscore, true);

    const linescorePromises = [
      prisma.linescore.create({ data: awayData }),
      prisma.linescore.create({ data: homeData }),
    ];

    await Promise.all(linescorePromises);
    await prisma.game.update({
      where: { id: game.id },
      data: { linescoresFetched: true },
    });
  }
};

fetchLinescores(inputDate)
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
