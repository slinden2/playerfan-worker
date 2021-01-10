if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const { isValidDate, contentUrl } = require("./fetchHelpers");
const getGames = require("./getGames");

const prisma = new PrismaClient();

const inputDate = process.argv[2];

// validate date string
if (inputDate) {
  isValidDate(inputDate);
}

const createPlayback = (highlight, playbacks) => {
  const playbackPromises = [];

  for (const playback of playbacks) {
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

const fetchPlaybacks = async (date) => {
  const games = await getGames(date);

  for (const game of games) {
    const {
      data: { media: milestoneData },
    } =
      (globalThis.__CONTENT__ && globalThis.__CONTENT__[game.gamePk]) ||
      (await axios.get(contentUrl(game.gamePk)));

    const highlightsInDb = await prisma.highlight.findMany({
      where: { gamePk: game.gamePk },
    });

    const playbackPromises = [];
    for (highlight of highlightsInDb) {
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
    await Promise.all(playbackPromises);
    await prisma.game.update({
      where: { id: game.id },
      data: { playbacksFetched: true },
    });
  }
};

fetchPlaybacks(inputDate)
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
