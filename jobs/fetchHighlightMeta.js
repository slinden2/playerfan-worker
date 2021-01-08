if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const _ = require("lodash");

const {
  isValidDate,
  liveFeedUrl,
  convertMMSStoSec,
} = require("./fetchHelpers");
const getGames = require("./getGames");

const prisma = new PrismaClient();

const inputDate = process.argv[2];

// validate date string
if (inputDate) {
  isValidDate(inputDate);
}

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
      season_teamIdApi: { season: process.env.SEASON, teamIdApi: goal.team.id },
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
    emptyNet: goal.result.emptyNet,
    type: goal.result.eventTypeId,
    shotType: goal.result.secondaryType,
    periodType: goal.about.periodType,
    periodNumber: goal.about.period,
    periodTime: convertMMSStoSec(goal.about.periodTime),
    dateTime: new Date(goal.about.dateTime).toISOString(),
    coordX: goal.coordinates.x,
    coordY: goal.coordinates.y,
    ...(scorer && { scorer: { connect: { id: scorer.id } } }),
    ...(assist1 && { assist1: { connect: { id: assist1.id } } }),
    ...(assist2 && { assist2: { connect: { id: assist2.id } } }),
    ...(goalie && { goalie: { connect: { id: goalie.id } } }),
    team: { connect: { id: team.id } },
    highlight: { connect: { id: highlight.id } },
  };
};

const fetchHighlightMeta = async (date) => {
  const latestGames = await getGames(date);
  for (const game of latestGames) {
    const liveFeedData = await axios.get(liveFeedUrl(game.gamePk));
    const {
      data: {
        liveData: {
          plays: { allPlays },
        },
      },
    } = liveFeedData;

    const goals = allPlays.filter(
      ({ result }) => result.eventTypeId === "GOAL"
    );

    const metaPromiseArr = [];
    for (const goal of goals) {
      const newMetaDataObject = await createMetaDataObject(game, goal);
      metaPromiseArr.push(
        prisma.highlightMeta.create({ data: newMetaDataObject })
      );
    }
    await Promise.all(metaPromiseArr);
  }
};

fetchHighlightMeta(inputDate)
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
