if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getGames = async ({ fetchMode, inputArg, flags }) => {
  let games;

  switch (fetchMode) {
    case "DATE":
      games = await prisma.game.findMany({
        where: { apiDate: new Date(inputArg).toISOString() },
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    case "GAMEPK":
      games = await prisma.game.findMany({
        where: { gamePk: parseInt(inputArg) },
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    case "FLAG":
      games = await prisma.game.findMany({
        where: flags,
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    default:
      throw new Error(`Incorrect 'fetchMode': ${fetchMode}`);
  }
  return games;
};

module.exports = getGames;
