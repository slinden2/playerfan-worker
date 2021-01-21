/**
 * This works for season 2019/2020. Divisions changed for 2020/2021 and API not yet updated
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const divisions20192020 = require("./divisions20192020.json");
const divisions20202021 = require("./divisions20202021.json");

const prisma = new PrismaClient();

// const divionsUrl = "https://statsapi.web.nhl.com/api/v1/divisions";

const conferenceDivMap = {
  20192020: { ATL: 6, CEN: 5, Metro: 6, PAC: 5 },
  20202021: { CEN: 6, WST: 5, EST: 6, NTH: 5 },
};

const divisions = {
  20192020: divisions20192020,
  20202021: divisions20202021,
};

const fetchDivisions = async () => {
  try {
    for (const division of divisions[process.env.SEASON]) {
      const divisionInDb = await prisma.division.findUnique({
        where: {
          season_divisionIdApi: {
            divisionIdApi: division.divisionId,
            season: process.env.SEASON,
          },
        },
      });
      if (divisionInDb) continue;

      const conferenceIdApi =
        conferenceDivMap[process.env.SEASON][division.shortName];

      const newDivision = {
        season: process.env.SEASON,
        divisionIdApi: division.divisionId,
        link: division.link,
        name: division.name,
        shortName: division.shortName,
        abbreviation: division.abbreviation,
        conference: {
          connect: {
            season_conferenceIdApi: {
              conferenceIdApi,
              season: process.env.SEASON,
            },
          },
        },
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
