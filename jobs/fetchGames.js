if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const { validateDate, gamesUrl, getApiData } = require("./fetchHelpers");

const prisma = new PrismaClient();

/**
 * Fetchs all games from the API for a date
 * @param {string} date YYYY-MM-DD
 */
const fetchGames = async (date) => {
  const url = gamesUrl(date);
  console.log(`fetchGames - url: ${url}`);

  try {
    // If the games were already fetched, delete them before refetching
    await prisma.game.deleteMany({
      where: { apiDate: new Date(date).toISOString() },
    });

    const {
      data: { dates },
    } = await getApiData(url);

    if (!dates.length) {
      throw new Error(`fetchGames - No games available: ${url}`);
    }

    const { games } = dates[0];

    for (const game of games) {
      try {
        const existingGame = await prisma.game.findUnique({
          where: { gamePk: game.gamePk },
        });

        // If there is an existing game, it means that it has been saved in the DB
        // but it was postponed (statusCode was not 7). Only games with
        // statusCode 7 are processed further.
        // When the postponed game is found on a later date, it will be updated
        // with new score, statusCode and apiDate. Then the other fetch scripts
        // pick it up and finalize the fetch.
        if (existingGame) {
          console.log(`fetchGames - Found gamePk ${game.gamePk} already in DB`);
          await prisma.game.update({
            where: { id: existingGame.id },
            data: {
              statusCode: Number(game.status.statusCode),
              awayScore: game.teams.away.score,
              homeScore: game.teams.home.score,
              apiDate,
              gameDate: new Date(game.gameDate).toISOString(),
            },
          });
          console.log(`fetchGames - Game updated: ${game.gamePk}`);
          continue;
        }

        console.log(`fetchGames - Creating gamePk ${game.gamePk}`);
        const awayTeam = await prisma.team.findUnique({
          where: {
            teamIdApi: game.teams.away.team.id,
          },
          select: { id: true, teamIdApi: true },
        });

        const homeTeam = await prisma.team.findUnique({
          where: {
            teamIdApi: game.teams.home.team.id,
          },
          select: { id: true, teamIdApi: true },
        });

        const apiDate = new Date(date).toISOString();

        const newGame = {
          gamePk: game.gamePk,
          statusCode: Number(game.status.statusCode),
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
