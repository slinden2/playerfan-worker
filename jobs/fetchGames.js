if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const { validateDate, gamesUrl, getApiData } = require("./fetchHelpers");

const prisma = new PrismaClient();

const fetchGames = async (date) => {
  const url = gamesUrl(date);
  console.log(`fetchGames - url: ${url}`);

  try {
    const {
      data: { dates },
    } = await getApiData(url);

    if (!dates.length) {
      throw new Error(`fetchGames - No games available: ${url}`);
    }

    const { games } = dates[0];

    for (const game of games) {
      try {
        await prisma.game.deleteMany({
          where: { apiDate: new Date(data).toISOString() },
        });

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
  const date = process.argv[2];
  validateDate(date);
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
