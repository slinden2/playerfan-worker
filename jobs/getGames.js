if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getGames = async ({ fetchMode, inputArg, flag }) => {
  let games;
  switch (fetchMode) {
    case "DATE":
      games = await prisma.game.findMany({
        where: { apiDate: new Date(inputArg).toISOString() },
      });
      break;
    case "GAMEPK":
      games = await prisma.game.findMany({
        where: { gamePk: parseInt(inputArg) },
      });
      break;
    case "FLAG":
      games = await prisma.game.findMany({ where: { [flag]: false } });
      break;
    default:
      throw new Error(`Incorrect 'fetchMode': ${fetchMode}`);
  }
  return games;
};

module.exports = getGames;
