/**
 * This works for season 2019/2020. Divisions changed for 2020/2021 and API not yet updated
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const teams = require("./teams.json");
const { generateTeamSiteLink } = require("./fetchHelpers");

const prisma = new PrismaClient();

const teamsUrl = "https://statsapi.web.nhl.com/api/v1/teams";

const conferenceTeamMap = {
  NJD: {
    conference: 6,
    division: 18,
  },
  NYI: {
    conference: 6,
    division: 18,
  },
  NYR: {
    conference: 6,
    division: 18,
  },
  PHI: {
    conference: 6,
    division: 18,
  },
  PIT: {
    conference: 6,
    division: 18,
  },
  BOS: {
    conference: 6,
    division: 17,
  },
  BUF: {
    conference: 6,
    division: 17,
  },
  MTL: {
    conference: 6,
    division: 17,
  },
  OTT: {
    conference: 6,
    division: 17,
  },
  TOR: {
    conference: 6,
    division: 17,
  },
  CAR: {
    conference: 6,
    division: 18,
  },
  FLA: {
    conference: 6,
    division: 17,
  },
  TBL: {
    conference: 6,
    division: 17,
  },
  WSH: {
    conference: 6,
    division: 18,
  },
  CHI: {
    conference: 5,
    division: 16,
  },
  DET: {
    conference: 6,
    division: 17,
  },
  NSH: {
    conference: 5,
    division: 16,
  },
  STL: {
    conference: 5,
    division: 16,
  },
  CGY: {
    conference: 5,
    division: 15,
  },
  COL: {
    conference: 5,
    division: 16,
  },
  EDM: {
    conference: 5,
    division: 15,
  },
  VAN: {
    conference: 5,
    division: 15,
  },
  ANA: {
    conference: 5,
    division: 15,
  },
  DAL: {
    conference: 5,
    division: 16,
  },
  LAK: {
    conference: 5,
    division: 15,
  },
  SJS: {
    conference: 5,
    division: 15,
  },
  CBJ: {
    conference: 6,
    division: 18,
  },
  MIN: {
    conference: 5,
    division: 16,
  },
  WPG: {
    conference: 5,
    division: 16,
  },
  ARI: {
    conference: 5,
    division: 15,
  },
  VGK: {
    conference: 5,
    division: 15,
  },
};

const fetchTeams = async () => {
  try {
    for (const team of teams) {
      try {
        const teamInDb = await prisma.team.findUnique({
          where: {
            season_teamId: { teamId: team.teamId, season: process.env.SEASON },
          },
        });
        if (teamInDb) continue;

        const conferenceId = conferenceTeamMap[team.abbreviation].conference;
        const divisionId = conferenceTeamMap[team.abbreviation].division;

        const newTeam = {
          season: process.env.SEASON,
          teamId: team.teamId,
          link: team.link,
          siteLink: generateTeamSiteLink(team.name),
          name: team.name,
          teamName: team.teamName,
          shortName: team.shortName,
          abbreviation: team.abbreviation,
          locationName: team.locationName,
          firstYearOfPlay: Number(team.firstYearOfPlay),
          officialSiteUrl: team.officialSiteUrl,
          conference: {
            connect: {
              conferenceId_season: { conferenceId, season: process.env.SEASON },
            },
          },
          division: {
            connect: {
              divisionId_season: { divisionId, season: process.env.SEASON },
            },
          },
          twitterHashtag: team.twitterHashtag,
          active: team.active,
        };

        await prisma.team.create({ data: newTeam });
      } catch ({ name, message }) {
        console.error(
          `fetch-team.fetchTeams.teamLoop - teamId: ${team.id} | name: ${team.shortName}`
        );
        console.log(`${name}: ${message}`);
      }
    }
  } catch ({ name, message }) {
    console.error(`fetch-teams.fetchTeams - url: ${teamsUrl}`);
    console.error(`${name}: ${message}`);
  }
};

fetchTeams()
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
