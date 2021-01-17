if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const getGames = require("./getGames");
const {
  getApiData,
  getPlayersWithoutScratches,
  validateInputArgs,
  logBatch,
  liveFeedUrl,
} = require("./fetchHelpers");

const prisma = new PrismaClient();

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

const fetchLinescores = async ({ fetchMode, inputArg }) => {
  const games = await getGames({
    fetchMode,
    inputArg,
    flags: { linescoresFetched: false },
  });

  logBatch("fetchLinescores", games);

  for (const game of games) {
    try {
      const url = liveFeedUrl(game.gamePk);
      console.log(`fetchLinescores - url: ${url}`);
      const {
        data: {
          liveData: { boxscore, linescore },
        },
      } = await getApiData(url);

      const awayData = getLinescoreObject(game, linescore, boxscore, false);
      const homeData = getLinescoreObject(game, linescore, boxscore, true);

      const linescorePromises = [
        prisma.linescore.create({ data: awayData }),
        prisma.linescore.create({ data: homeData }),
      ];

      console.log("fetchLinescores - Saving linescores");
      await Promise.all(linescorePromises);
      await prisma.game.update({
        where: { id: game.id },
        data: { linescoresFetched: true },
      });
      console.log(`fetchLinescores - Game ${game.gamePk} done`);
    } catch (err) {
      console.error(
        `fetchLinescores - Error while working on ${game.gamePk}.\n${err.stack}`
      );
      continue;
    }
  }
};

if (require.main === module) {
  const inputArgs = validateInputArgs(process.argv);
  fetchLinescores(inputArgs)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}

module.exports = fetchLinescores;
