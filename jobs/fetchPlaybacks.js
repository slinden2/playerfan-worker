if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const {
  contentUrl,
  logBatch,
  getApiData,
  validateInputArgs,
} = require("./fetchHelpers");
const getGames = require("./getGames");

const prisma = new PrismaClient();

const createPlayback = (highlight, playbacks) => {
  const playbackPromises = [];

  for (const playback of playbacks) {
    // Discard empty urls
    if (!playback.url) {
      continue;
    }

    playbackPromises.push(
      prisma.playback.create({
        data: {
          url: playback.url,
          type: {
            connectOrCreate: {
              where: { name: playback.name },
              create: {
                name: playback.name,
                width:
                  playback.width === "null"
                    ? null
                    : playback.width && parseInt(playback.width),
                height:
                  playback.height === "null"
                    ? null
                    : playback.width && parseInt(playback.height),
              },
            },
          },
          highlight: {
            connect: {
              id: highlight.id,
            },
          },
        },
      })
    );
  }
  return playbackPromises;
};

const fetchPlaybacks = async ({ fetchMode, inputArg }) => {
  const games = await getGames({
    fetchMode,
    inputArg,
    flags: { highlightsFetched: true, playbacksFetched: false },
  });

  logBatch("fetchPlaybacks", games);

  for (const game of games) {
    try {
      if (fetchMode === "GAMEPK") {
        // Delete partially fetched playbacks
        await prisma.playback.deleteMany({
          where: { highlight: { gamePk: game.gamePk } },
        });
      }

      const url = contentUrl(game.gamePk);
      console.log(`fetchPlaybacks - url: ${url}`);
      const {
        data: { media: milestoneData },
      } = await getApiData(url);

      const highlightsInDb = await prisma.highlight.findMany({
        where: { gamePk: game.gamePk },
      });

      const playbackPromises = [];
      for (highlight of highlightsInDb) {
        if (fetchMode === "GAMEPK") {
          console.log(
            `fetchPlaybacks - Creating playbacks for highlight ${highlight.videoIdApi}`
          );
        }
        let playbacksInApi;
        switch (highlight.type) {
          case "CONDENSED":
            const condensedGame = milestoneData.epg.find(
              (category) => category.title === "Extended Highlights"
            );
            playbacksInApi = condensedGame.items[0].playbacks;
            break;
          case "RECAP":
            const gameRecap = milestoneData.epg.find(
              (category) => category.title === "Recap"
            );
            playbacksInApi = gameRecap.items[0].playbacks;
            break;
          case "MILESTONE":
            const milestone = milestoneData.milestones.items.find(
              (milestone) =>
                milestone.highlight.id === highlight.videoIdApi.toString()
            );
            playbacksInApi = milestone.highlight.playbacks;
            break;
          default:
            throw new Error(
              `Attempted to create playbacks for highlightType ${highlight.type}, which is not handled.`
            );
        }
        const promises = createPlayback(highlight, playbacksInApi);
        playbackPromises.push(...promises);
      }
      console.log("fetchPlaybacks - Saving playbacks");
      await prisma.$transaction(playbackPromises);
      await prisma.game.update({
        where: { id: game.id },
        data: { playbacksFetched: true },
      });
      console.log(`fetchPlaybacks - Game ${game.gamePk} done`);
    } catch (err) {
      console.error(
        `fetchPlaybacks - Error while working on ${game.gamePk}.\n${err.stack}`
      );
      continue;
    }
  }
};

if (require.main === module) {
  const inputArgs = validateInputArgs(process.argv);
  fetchPlaybacks(inputArgs)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}

module.exports = fetchPlaybacks;
