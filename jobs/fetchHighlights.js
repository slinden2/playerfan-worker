if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const _ = require("lodash");

const {
  convertMMSStoSec,
  contentUrl,
  validateInputArgs,
  getApiData,
  logBatch,
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

  logBatch("fetchHighlights", games);

  for (const game of games) {
    try {
      if (fetchMode === "GAMEPK") {
        await prisma.highlight.deleteMany({ where: { gamePk: game.gamePk } });
      }

      const url = contentUrl(game.gamePk);
      console.log(`fetchHighlights - url: ${url}`);
      const {
        data: { media: milestoneData },
      } = await getApiData(url);

      const condensedGame = milestoneData.epg.find(
        (category) => category.title === "Extended Highlights"
      );
      const gameRecap = milestoneData.epg.find(
        (category) => category.title === "Recap"
      );

      let hasCondensedVideo = !!condensedGame.items.length;
      let hasRecapVideo = !!gameRecap.items.length;

      // Check is condensed and recap are actually the same highlight (gamePk)
      // Example: https://statsapi.web.nhl.com/api/v1/game/2019020799/content
      if (hasCondensedVideo && hasRecapVideo) {
        if (condensedGame.items[0].id === gameRecap.items[0].id) {
          if (gameRecap.items[0].title.startsWith("Recap:")) {
            hasCondensedVideo = false;
          } else {
            hasRecapVideo = false;
          }
        }
      }

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
        if (fetchMode === "GAMEPK") {
          console.log(
            `fetchHighlights - Creating videoIdApi: ${milestone.highlight.id}`
          );
        }
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
module.exports = fetchHighlights;
