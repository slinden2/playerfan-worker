if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const {
  convertMMSStoSec,
  logBatch,
  validateInputArgs,
  getApiData,
  liveFeedUrl,
} = require("./fetchHelpers");
const getGames = require("./getGames");

const prisma = new PrismaClient();

/**
 * Creates a highlightMeta object that can be saved in the DB
 * @param {*} game Game object from DB
 * @param {*} goal Goal object from API
 */
const createMetaDataObject = async (game, goal) => {
  let scorer;
  let assist1;
  let assist2;
  let goalie;

  const scorerData = goal.players.find((p) => p.playerType === "Scorer");
  if (scorerData) {
    scorer = await prisma.player.findUnique({
      where: { playerIdApi: scorerData.player.id },
      select: { id: true },
    });
  }

  const assistData = goal.players.filter(
    (player) => player.playerType === "Assist"
  );

  if (assistData.length) {
    assist1 = await prisma.player.findUnique({
      where: { playerIdApi: assistData[0].player.id },
      select: { id: true },
    });
  }

  if (assistData.length === 2) {
    assist2 = await prisma.player.findUnique({
      where: { playerIdApi: assistData[1].player.id },
      select: { id: true },
    });
  }

  const goalieData = goal.players.find(
    (player) => player.playerType === "Goalie"
  );
  if (goalieData) {
    goalie = await prisma.player.findUnique({
      where: { playerIdApi: goalieData.player.id },
      select: { id: true },
    });
  }

  const team = await prisma.team.findUnique({
    where: {
      teamIdApi: goal.team.id,
    },
    select: { id: true },
  });

  const highlight = await prisma.highlight.findFirst({
    where: { gamePk: game.gamePk, eventIdApi: goal.about.eventId },
    select: { id: true },
  });

  return {
    gamePk: game.gamePk,
    eventIdxApi: goal.about.eventIdx,
    eventIdApi: goal.about.eventId,
    gameWinningGoal: goal.result.gameWinningGoal,
    emptyNet: goal.result.emptyNet || false,
    type: goal.result.eventTypeId,
    shotType: goal.result.secondaryType || "NA",
    periodType: goal.about.periodType,
    periodNumber: goal.about.period,
    periodTime: convertMMSStoSec(goal.about.periodTime),
    dateTime: new Date(goal.about.dateTime).toISOString(),
    coordX: goal.coordinates.x,
    coordY: goal.coordinates.y,
    hasVideo: !!highlight,
    ...(scorer && { scorer: { connect: { id: scorer.id } } }),
    ...(assist1 && { assist1: { connect: { id: assist1.id } } }),
    ...(assist2 && { assist2: { connect: { id: assist2.id } } }),
    ...(goalie && { goalie: { connect: { id: goalie.id } } }),
    team: { connect: { id: team.id } },
    ...(highlight && { highlight: { connect: { id: highlight.id } } }),
  };
};

/**
 * Fetches highlightMeta from API. This is practically shot and goal data.
 * @param {{ fetchMode: string, inputArg: string | undefined }} options fetchMode: (DATE|GAMEPK|FLAG). inputArg not needed with FLAG.
 */
const fetchHighlightMeta = async ({ fetchMode, inputArg }) => {
  const games = await getGames({
    fetchMode,
    inputArg,
    flags: { highlightsFetched: true, highlightMetaFetched: false },
  });

  logBatch("fetchHighlightMeta", games);

  for (const game of games) {
    try {
      if (fetchMode === "GAMEPK") {
        await prisma.highlightMeta.deleteMany({
          where: {
            highlight: { gamePk: game.gamePk },
          },
        });
      }

      const url = liveFeedUrl(game.gamePk);
      console.log(`fetchHighlightMeta - url: ${url}`);
      const {
        data: {
          liveData: {
            plays: { allPlays },
          },
        },
      } = await getApiData(url);

      const goals = allPlays.filter(
        ({ result }) => result.eventTypeId === "GOAL"
      );

      const metaPromiseArr = [];
      for (const goal of goals) {
        if (fetchMode === "GAMEPK") {
          console.log(
            `fetchHighlightMeta - Creating goal eventIdApi: ${goal.about.eventId}`
          );
        }
        const newMetaDataObject = await createMetaDataObject(game, goal);
        metaPromiseArr.push(
          prisma.highlightMeta.create({ data: newMetaDataObject })
        );
      }
      console.log("fetchHighlightMeta - Saving highlight metas");
      await prisma.$transaction(metaPromiseArr);
      await prisma.game.update({
        where: { id: game.id },
        data: { highlightMetaFetched: true },
      });
      `fetchHighlightMeta - Game ${game.gamePk} done`;
    } catch (err) {
      console.error(
        `fetchHighlighMeta - Error while working on ${game.gamePk}\n${err.stack}`
      );
      continue;
    }
  }
};

if (require.main === module) {
  const inputArgs = validateInputArgs(process.argv);
  fetchHighlightMeta(inputArgs)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}

module.exports = fetchHighlightMeta;
