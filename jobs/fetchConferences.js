if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

const conferenceUrl = "https://statsapi.web.nhl.com/api/v1/conferences";

const fetchConferences = async () => {
  try {
    const response = await axios.get(conferenceUrl);
    for (const conference of response.data.conferences) {
      const conferenceInDb = await prisma.conference.findUnique({
        where: {
          conferenceId_season: {
            conferenceId: conference.id,
            season: process.env.SEASON,
          },
        },
      });
      if (conferenceInDb) continue;

      const newConference = {
        season: process.env.SEASON,
        conferenceId: conference.id,
        name: conference.name,
        link: conference.link,
        abbreviation: conference.abbreviation,
        shortName: conference.shortName,
        active: conference.active,
      };

      await prisma.conference.create({
        data: newConference,
      });
    }
  } catch ({ name, message }) {
    console.error("fetch-conferences.fetchConferences");
    console.error(`${name}: ${message}`);
  }
};

fetchConferences()
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
