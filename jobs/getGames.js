if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const { validateDate } = require("./fetchHelpers");

const prisma = new PrismaClient();

const getGames = async ({ fetchMode, inputArg, flags }) => {
  let games;

  switch (fetchMode) {
    case "DATE":
      validateDate(inputArg);
      games = await prisma.game.findMany({
        where: { statusCode: 7, apiDate: new Date(inputArg).toISOString() },
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    case "GAMEPK":
      games = await prisma.game.findMany({
        where: { statusCode: 7, gamePk: parseInt(inputArg) },
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    case "FLAG":
      games = await prisma.game.findMany({
        where: { statusCode: 7, ...flags },
        include: { homeTeam: true, awayTeam: true },
      });
      break;
    default:
      throw new Error(`Incorrect 'fetchMode': ${fetchMode}`);
  }
  return games;
};

module.exports = getGames;
