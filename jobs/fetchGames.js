if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const { isValidDate } = require("./fetchHelpers");
const createHighlight = require("./createHighlight");

const prisma = new PrismaClient();

// validate date string
if (process.argv[2]) {
  isValidDate(process.argv[2]);
}

const timeYesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

// construct current date in YYYY-MM-DD format
const UTC_DATE = timeYesterday.toISOString().split("T")[0];
const date = process.argv[2] || UTC_DATE;

const gamesUrl = (date) =>
  `https://statsapi.web.nhl.com/api/v1/schedule?date=${date}`;

const contentUrl = (gamePk) =>
  `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/content`;

const fetchGames = async (date) => {
  const url = gamesUrl(date);
  console.log(`fetchGames - url: ${url}`);

  try {
    const {
      data: { dates },
    } = await axios.get(url);

    if (!dates.length) {
      throw new Error(`No games available: ${url}`);
    }

    const { games } = dates[0];
    for (const game of games) {
      const url = contentUrl(game.gamePk);
      console.log(`fetchGames.contentUrl - url: ${url}`);

      const {
        data: { media },
      } = await axios.get(url);

      const awayTeam = await prisma.team.findUnique({
        where: {
          season_teamIdApi: {
            season: process.env.SEASON,
            teamIdApi: game.teams.away.team.id,
          },
        },
        select: { id: true, teamIdApi: true },
      });

      const homeTeam = await prisma.team.findUnique({
        where: {
          season_teamIdApi: {
            season: process.env.SEASON,
            teamIdApi: game.teams.home.team.id,
          },
        },
        select: { id: true, teamIdApi: true },
      });

      const condensedGame = media.epg.find(
        (category) => category.title === "Extended Highlights"
      );
      const gameRecap = media.epg.find(
        (category) => category.title === "Recap"
      );

      const apiDate = new Date(date).toISOString();

      const newGame = {
        gamePk: game.gamePk,
        liveLink: game.link,
        contentLink: game.content.link,
        gameDate: new Date(game.gameDate).toISOString(),
        apiDate,
        gameType: game.gameType,
        awayScore: game.teams.away.score,
        homeScore: game.teams.home.score,
        awayTeam: {
          connect: {
            id: awayTeam.id,
          },
        },
        homeTeam: {
          connect: {
            id: homeTeam.id,
          },
        },
      };

      const savedGame = await prisma.game.create({ data: newGame });

      const hasCondensedVideo = !!condensedGame.items.length;
      const hasRecapVideo = !!gameRecap.items.length;

      if (hasCondensedVideo) {
        await createHighlight(
          condensedGame.items[0],
          "CONDENSED",
          savedGame.id
        );
      }
      if (hasRecapVideo) {
        await createHighlight(gameRecap.items[0], "RECAP", savedGame.id);
      }
    }
  } catch (err) {
    console.error(`fetchGames - date: ${date}\n${err.stack}`);
  }
};

console.log(`fetchGames.fetch-started-${date}`);

fetchGames(date)
  .catch((e) => {
    throw e;
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
