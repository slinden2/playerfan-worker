/**
 * This works for season 2019/2020. Divisions changed for 2020/2021 and API not yet updated
 */

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const divisions = require("./divisions.json");

const prisma = new PrismaClient();

const divionsUrl = "https://statsapi.web.nhl.com/api/v1/divisions";

const ConferenceDivMap = {
  ATL: 6,
  CEN: 5,
  Metro: 6,
  PAC: 5,
};

const fetchDivisions = async () => {
  try {
    for (const division of divisions) {
      const divisionInDb = await prisma.division.findUnique({
        where: { divisionId: division.divisionId },
      });
      if (divisionInDb) continue;

      const conferenceId = ConferenceDivMap[division.shortName];

      const newDivision = {
        divisionId: division.divisionId,
        link: division.link,
        name: division.name,
        shortName: division.shortName,
        abbreviation: division.abbreviation,
        conference: { connect: { conferenceId } },
        active: division.active,
      };
      await prisma.division.create({
        data: newDivision,
      });
    }
  } catch ({ name, message }) {
    console.error("fetch-divisions.fetchDivisions");
    console.error(`${name}: ${message}`);
  }
};

fetchDivisions()
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
