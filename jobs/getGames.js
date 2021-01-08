if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getGames = async (date) => {
  let apiDate;

  if (date) {
    apiDate = new Date(date).toISOString();
  } else {
    const latestGameDate = await prisma.game.aggregate({
      max: { apiDate: true },
    });
    apiDate = latestGameDate.max.apiDate;
  }

  const latestGames = await prisma.game.findMany({
    where: { apiDate },
    include: { homeTeam: true, awayTeam: true },
  });

  return latestGames;
};

module.exports = getGames;
