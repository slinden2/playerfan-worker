if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const { validateDate } = require("../jobs/fetchHelpers");

const prisma = new PrismaClient();

const resetGamesByDate = async (date) => {
  try {
    const games = await prisma.game.findMany({
      where: { apiDate: new Date(date).toISOString() },
    });

    for (const game of games) {
      await prisma.skaterBoxscore.deleteMany({ where: { gameId: game.id } });
      await prisma.goalieBoxscore.deleteMany({ where: { gameId: game.id } });
      await prisma.linescore.deleteMany({ where: { gameId: game.id } });

      const highlights = await prisma.highlight.findMany({
        where: { gameId: game.id },
      });
      for (const hl of highlights) {
        await prisma.playback.deleteMany({ where: { highlightId: hl.id } });
        await prisma.comment.deleteMany({ where: { highlightId: hl.id } });
        await prisma.$executeRaw(
          `DELETE FROM "_UserLikesHighlight" WHERE "A" = '${hl.id}' OR "B" = '${hl.id}';`
        );
      }
      await prisma.highlightMeta.deleteMany({
        where: { gamePk: game.gamePk },
      });
      await prisma.highlight.deleteMany({ where: { gamePk: game.gamePk } });
      await prisma.game.delete({ where: { gamePk: game.gamePk } });
    }
  } catch ({ name, message }) {
    console.error("resetGamesByDate");
    console.error(`${name}: ${message}`);
  }
};

const date = process.argv[2];
validateDate(date);

resetGamesByDate(date)
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
