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
        where: { conferenceIdApi: conference.id },
      });

      if (conferenceInDb) {
        await prisma.conference.update({
          where: { id: conferenceInDb.id },
          data: { activeSeasons: { create: { season: process.env.SEASON } } },
        });
        continue;
      }

      const newConference = {
        conferenceIdApi: conference.id,
        name: conference.name,
        link: conference.link,
        abbreviation: conference.abbreviation,
        shortName: conference.shortName,
        activeSeasons: {
          create: {
            season: process.env.SEASON,
          },
        },
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
