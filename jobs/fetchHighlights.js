if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const _ = require("lodash");

const {
  convertMMSStoSec,
  contentUrl,
  validateInputArgs,
} = require("./fetchHelpers");
const getGames = require("./getGames");

const prisma = new PrismaClient();

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

const fetchHighlights = async ({ fetchMode, inputArg }) => {
  const games = await getGames({
    fetchMode,
    inputArg,
    flags: { boxscoresFetched: true, highlightsFetched: false },
  });

  const gamePks = games.map((g) => g.gamePk);
  if (gamePks.length) {
    console.log(`fetchHighlights - Starting to fetch batch: ${gamePks}`);
  }

  for (const game of games) {
    try {
      `fetchHighlights - url: ${contentUrl(game.gamePk)}`;
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
        console.log(
          `fetchHighlights - Creating videoIdApi: ${milestone.highlight.id}`
        );
        const team =
          game.homeTeam.teamIdApi === parseInt(milestone.teamId)
            ? game.homeTeam
            : game.awayTeam;
        const opponent =
          game.homeTeam.teamIdApi === parseInt(milestone.teamId)
            ? game.awayTeam
            : game.homeTeam;
        if (milestone.playerId) {
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

      console.log("fetchHighlights - Saving highlights");
      await Promise.all(highlightPromises);
      await prisma.game.update({
        where: { id: game.id },
        data: { highlightsFetched: true },
      });
      console.log(`fetchHighlights - Game ${game.gamePk} done`);
    } catch (err) {
      console.error(
        `fetchHighlights - Error while working on ${game.gamePk}\n${err.stack}`
      );
      continue;
    }
  }
};

if (require.main === module) {
  const inputArgs = validateInputArgs(process.argv);
  fetchHighlights(inputArgs)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}
