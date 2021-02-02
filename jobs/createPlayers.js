if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const {
  playerUrl,
  generateSiteLink,
  convertFtToCm,
  convertLbsToKg,
} = require("./fetchHelpers");

const prisma = new PrismaClient();

const createPlayerObject = (player, team, game) => {
  return {
    playerIdApi: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    primaryNumber: parseInt(player.primaryNumber),
    link: player.link,
    siteLink: generateSiteLink(player.fullName),
    birthDate: new Date(Date.parse(player.birthDate)).toISOString(),
    birthCity: player.birthCity,
    birthStateProvince: player.birthStateProvince,
    birthCountry: player.birthCountry,
    nationality: player.nationality,
    height: convertFtToCm(player.height),
    weight: convertLbsToKg(player.weight),
    alternateCaptain: !!player.alternateCaptain,
    captain: !!player.captain,
    rookie: player.rookie,
    shootsCatches: player.shootsCatches,
    rosterStatus: player.rosterStatus,
    primaryPosition:
      player.primaryPosition.code === "N/A"
        ? "NA"
        : player.primaryPosition.code,
    active: player.active,
    teams: {
      create: { team: { connect: { id: team.id } }, startDate: game.apiDate },
    },
  };
};

const createPlayers = async (newPlayers, gamePk, teamId) => {
  console.log(
    `createPlayers - playersToAdd: ${newPlayers} | gamePk: ${gamePk}`
  );

  let playerArray = [];
  for (const id of newPlayers) {
    console.log(`Fetching player from ${playerUrl(id)}`);
    const { data } = await axios.get(playerUrl(id));
    if (data) {
      playerArray = [...playerArray, data.people[0]];
    }
  }

  for (const player of playerArray) {
    try {
      const teamInDb = await prisma.team.findUnique({
        where: {
          teamIdApi: teamId || player.currentTeam.id,
        },
      });
      const game = await prisma.game.findUnique({
        where: { gamePk },
        select: { apiDate: true },
      });
      const playerObj = createPlayerObject(player, teamInDb, game);

      await prisma.player.create({
        data: playerObj,
      });
    } catch (err) {
      console.error(
        `createPlayers.playerLoop - playerId: ${player.id} | ${gamePk}\n`,
        err.stack
      );
      continue;
    }
  }
};

module.exports = createPlayers;
