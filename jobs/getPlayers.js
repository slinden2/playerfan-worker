if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const { getPlayersWithoutScratches } = require("./fetchHelpers");

const prisma = new PrismaClient();

const getPlayers = async (teams) => {
  const skatersHome = getPlayersWithoutScratches(
    teams.home.skaters,
    teams.home.scratches
  );
  const skatersAway = getPlayersWithoutScratches(
    teams.away.skaters,
    teams.away.scratches
  );
  const goaliesHome = getPlayersWithoutScratches(
    teams.home.goalies,
    teams.home.scratches
  );
  const goaliesAway = getPlayersWithoutScratches(
    teams.away.goalies,
    teams.away.scratches
  );

  const playerIdsHome = [...skatersHome, ...goaliesHome];
  const playerIdsAway = [...skatersAway, ...goaliesAway];

  let playerIdsInDbHome = await prisma.player.findMany({
    where: { playerIdApi: { in: playerIdsHome } },
    select: { playerIdApi: true },
  });

  let playerIdsInDbAway = await prisma.player.findMany({
    where: { playerIdApi: { in: playerIdsAway } },
    select: { playerIdApi: true },
  });

  playerIdsInDbHome = playerIdsInDbHome.map((p) => p.playerIdApi);
  playerIdsInDbAway = playerIdsInDbAway.map((p) => p.playerIdApi);

  return {
    inDb: { home: playerIdsInDbHome, away: playerIdsInDbAway },
    notInDb: {
      home: playerIdsHome.filter((pid) => !playerIdsInDbHome.includes(pid)),
      away: playerIdsAway.filter((pid) => !playerIdsInDbAway.includes(pid)),
    },
  };
};

module.exports = getPlayers;
