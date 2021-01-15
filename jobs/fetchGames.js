if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const { validateDate, gamesUrl } = require("./fetchHelpers");

const prisma = new PrismaClient();

const fetchGames = async (date) => {
  const url = gamesUrl(date);
  console.log(`fetchGames - url: ${url}`);

  try {
    const {
      data: { dates },
    } = await axios.get(url);

    if (!dates.length) {
      throw new Error(`fetchGames - No games available: ${url}`);
    }

    const { games } = dates[0];

    for (const game of games) {
      try {
        console.log(`fetchGames - Creating gamePk ${game.gamePk}`);
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

        await prisma.game.create({ data: newGame });
      } catch (err) {
        console.error(`fetchGames - gamePk: ${game.gamePk}\n${err.stack}`);
        continue;
      }
    }
  } catch (err) {
    console.error(`fetchGames - date: ${date}\n${err.stack}`);
  }
};

if (require.main === module) {
  // validate date string
  if (process.argv[2]) {
    validateDate(process.argv[2]);
  }

  const timeYesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

  // construct current date in YYYY-MM-DD format
  const UTC_DATE = timeYesterday.toISOString().split("T")[0];
  const date = process.argv[2] || UTC_DATE;

  fetchGames(date)
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      prisma.$disconnect();
      process.exit(0);
    });
}

module.exports = fetchGames;
