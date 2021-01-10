if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const _ = require("lodash");

const { isValidDate, convertMMSStoSec, contentUrl } = require("./fetchHelpers");
const getGames = require("./getGames");
const createPlayers = require("./createPlayers");

const prisma = new PrismaClient();

const inputDate = process.argv[2];

// validate date string
if (inputDate) {
  isValidDate(inputDate);
}

const createHighlightObject = (
  type,
  game,
  { highlightData, milestoneData }
) => {
  const obj = {
    type,
    gamePk: game.gamePk,
    videoIdApi: parseInt(highlightData.id),
    title: highlightData.title.trim(),
    blurb: highlightData.blurb.trim(),
    description: highlightData.description.trim(),
    duration: convertMMSStoSec(highlightData.duration),
    mediaPlaybackIdApi: parseInt(highlightData.mediaPlaybackId),
    ...(milestoneData && {
      eventIdApi: parseInt(milestoneData.eventIdApi),
      team: { connect: { id: milestoneData.team.id } },
      opponent: { connect: { id: milestoneData.opponent.id } },
    }),
    game: {
      connect: {
        id: game.id,
      },
    },
  };

  return obj;
};

const createPlaybackObject = async () => {};

const fetchHighlights = async (date) => {
  const games = await getGames(date);

  for (const game of games) {
    const {
      data: { media: milestoneData },
    } = await axios.get(contentUrl(game.gamePk));

    const condensedGame = milestoneData.epg.find(
      (category) => category.title === "Extended Highlights"
    );
    const gameRecap = milestoneData.epg.find(
      (category) => category.title === "Recap"
    );

    const hasCondensedVideo = !!condensedGame.items.length;
    const hasRecapVideo = !!gameRecap.items.length;

    const highlightPromises = [];
    if (hasCondensedVideo) {
      const condensedHighlightObj = createHighlightObject("CONDENSED", game, {
        highlightData: condensedGame.items[0],
      });
      highlightPromises.push(
        prisma.highlight.create({ data: condensedHighlightObj })
      );
    }

    if (hasRecapVideo) {
      const recapHighlightObj = createHighlightObject("RECAP", game, {
        highlightData: gameRecap.items[0],
      });
      highlightPromises.push(
        prisma.highlight.create({ data: recapHighlightObj })
      );
    }

    const rawMilestones = milestoneData.milestones.items.filter(
      (item) =>
        (item.type === "SHOT" || item.type === "GOAL") &&
        !_.isEmpty(item.highlight)
    );

    // Sometimes there are duplicate milestones. This removes duplicates.
    const milestones = _.uniqBy(rawMilestones, "highlight.id");

    for (const milestone of milestones) {
      const team =
        game.homeTeam.teamIdApi === parseInt(milestone.teamId)
          ? game.homeTeam
          : game.awayTeam;
      const opponent =
        game.homeTeam.teamIdApi === parseInt(milestone.teamId)
          ? game.awayTeam
          : game.homeTeam;
      if (milestone.playerId) {
        const playerId = parseInt(milestone.playerId);
        let player = await prisma.player.findUnique({
          where: { playerIdApi: playerId },
        });
        if (!player) {
          await createPlayers(
            [playerId],
            game.gamePk,
            parseInt(milestone.teamId)
          );
          player = await prisma.player.findUnique({
            where: { playerIdApi: playerId },
          });
        }

        const newHighlightData = createHighlightObject("MILESTONE", game, {
          highlightData: milestone.highlight,
          milestoneData: {
            eventIdApi: milestone.statsEventId,
            team,
            opponent,
          },
        });

        highlightPromises.push(
          prisma.highlight.create({
            data: newHighlightData,
          })
        );
      }
    }

    await Promise.all(highlightPromises);
    await prisma.game.update({
      where: { id: game.id },
      data: { highlightsFetched: true },
    });
  }
};

fetchHighlights(inputDate)
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
