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
  // 20202021: { CEN: 6, WST: 5, EST: 6, NTH: 5 },
};

const divisions = {
  20192020: divisions20192020,
  20202021: divisions20202021,
};

/**
 * Fetches divisions from json files and saves them in the DB.
 */
const fetchDivisions = async () => {
  try {
    console.log(
      `fetchDivisions - Starting to fetch division for season ${process.env.SEASON}`
    );

    // Get all existing divisions
    const existingDivisions = await prisma.division.findMany();

    // Divide the seasons divs into already existing (in db) and completely new divs
    const [existingDivs, divsToCreate] = divisions[process.env.SEASON].reduce(
      (acc, cur) => {
        const divInDb = existingDivisions.find(
          (div) => div.divisionIdApi === cur.divisionId
        );
        if (divInDb) {
          acc[0].push(cur);
        } else {
          acc[1].push(cur);
        }

        return acc;
      },
      [[], []]
    );

    // Create new divisions
    for (const division of divsToCreate) {
      console.log(`fetchDivisions - Creating new division "${division.name}"`);

      const divisionObject = {
        divisionIdApi: division.divisionId,
        link: division.link,
        name: division.name,
        shortName: division.shortName,
        abbreviation: division.abbreviation,
        activeSeasons: { create: { season: process.env.SEASON } },
      };

      await prisma.division.create({
        data: divisionObject,
      });
    }

    // Update existing divisions with a new activeSeason
    for (const division of existingDivs) {
      console.log(`fetchDivisions - Updating division "${division.name}"`);
      await prisma.division.update({
        where: { divisionIdApi: division.divisionId },
        data: { activeSeasons: { create: { season: process.env.SEASON } } },
      });
    }

    // Get all active divisions
    const activeDivisions = await prisma.division.findMany({
      where: { activeSeasons: { some: { season: process.env.SEASON } } },
    });

    console.log(`fetchDivisions - Adding conference references`);
    // Add a conference reference for the season for all active divisions if they need one
    for (const division of activeDivisions) {
      const confId =
        conferenceDivMap[process.env.SEASON]?.[division?.shortName];
      if (!confId) {
        console.log(
          `fetchDivisions - Division "${division.name}" has no conference refence`
        );
        continue;
      }

      const conference = await prisma.conference.findUnique({
        where: {
          conferenceIdApi:
            conferenceDivMap[process.env.SEASON]?.[division?.shortName],
        },
        select: { id: true, name: true },
      });

      console.log(
        `fetchDivisions - Adding a relation between division "${division.name}" and "${conference.name}".`
      );
      await prisma.divisionConference.create({
        data: {
          season: process.env.SEASON,
          conference: { connect: { id: conference.id } },
          division: { connect: { id: division.id } },
        },
      });
    }
    console.log(`fetchDivisions - Done`);
  } catch (err) {
    console.error("fetchDivisions", err.stack);
  }
};

fetchDivisions()
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
