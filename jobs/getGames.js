if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const { validateDate } = require("./fetchHelpers");

const prisma = new PrismaClient();

/**
 * Get games from DB based on options and returns an array.
 * flags option is used to define based on which flag the games should be queried. For example:
 * { boxscoresFetched: false } looks for games that have the flag boxscoresFetched set to FALSE.
 * @param {{ fetchMode: string, inputArg: string | undefined, flags: any }} options fetchMode: (DATE|GAMEPK|FLAG). inputArg not needed with FLAG
 */
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
