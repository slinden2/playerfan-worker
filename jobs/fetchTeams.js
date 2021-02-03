if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");
const genericTeamData = require("./genericTeamData.json");
const { generateSiteLink } = require("./fetchHelpers");

const prisma = new PrismaClient();

const teamsUrl = "https://statsapi.web.nhl.com/api/v1/teams";

const conferenceTeamMap = {
  20192020: {
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
  },
  20202021: {
    NJD: {
      division: 25,
    },
    NYI: {
      division: 25,
    },
    NYR: {
      division: 25,
    },
    PHI: {
      division: 25,
    },
    PIT: {
      division: 25,
    },
    BOS: {
      division: 25,
    },
    BUF: {
      division: 25,
    },
    MTL: {
      division: 28,
    },
    OTT: {
      division: 28,
    },
    TOR: {
      division: 28,
    },
    CAR: {
      division: 26,
    },
    FLA: {
      division: 26,
    },
    TBL: {
      division: 26,
    },
    WSH: {
      division: 25,
    },
    CHI: {
      division: 26,
    },
    DET: {
      division: 26,
    },
    NSH: {
      division: 26,
    },
    STL: {
      division: 27,
    },
    CGY: {
      division: 28,
    },
    COL: {
      division: 27,
    },
    EDM: {
      division: 28,
    },
    VAN: {
      division: 28,
    },
    ANA: {
      division: 27,
    },
    DAL: {
      division: 26,
    },
    LAK: {
      division: 27,
    },
    SJS: {
      division: 27,
    },
    CBJ: {
      division: 26,
    },
    MIN: {
      division: 27,
    },
    WPG: {
      division: 28,
    },
    ARI: {
      division: 27,
    },
    VGK: {
      division: 27,
    },
  },
};

/**
 * Creates new teams from `genericTeamData.json` in there are any not already in DB and
 * updates conference/division relations for the current season. Manual work required.
 */
const fetchTeams = async () => {
  try {
    console.log(
      `fetchTeams - Starting to fetch teams for season ${process.env.SEASON}`
    );

    for (const team of genericTeamData) {
      try {
        const conferenceIdApi =
          conferenceTeamMap[process.env.SEASON]?.[team.abbreviation]
            ?.conference;
        const divisionIdApi =
          conferenceTeamMap[process.env.SEASON]?.[team.abbreviation]?.division;

        // If conferenceIdApi or divisionIdApi is undefined the team
        // is not playing on the current season.
        // This allows teams to be added in genericTeamData and have previous
        // seasons fetching still working
        if (!conferenceIdApi && !divisionIdApi) {
          console.log(
            `fetchTeams - Team "${team.name}" is not active on season ${process.env.SEASON}`
          );
          continue;
        }

        let teamInDb = await prisma.team.findUnique({
          where: { teamIdApi: team.teamId },
        });

        // Update team if it was found already in DB
        if (teamInDb) {
          console.log(`fetchTeams - Updating team "${team.name}"`);

          await prisma.team.update({
            where: { id: teamInDb.id },
            data: {
              activeSeasons: { create: { season: process.env.SEASON } },
            },
          });
        } else {
          // Create a new team
          console.log(`fetchTeams - Creating new team "${team.name}"`);
          const newTeam = {
            teamIdApi: team.teamId,
            link: team.link,
            siteLink: generateSiteLink(team.name),
            name: team.name,
            teamName: team.teamName,
            shortName: team.shortName,
            abbreviation: team.abbreviation,
            locationName: team.locationName,
            firstYearOfPlay: Number(team.firstYearOfPlay),
            officialSiteUrl: team.officialSiteUrl,
            twitterHashtag: team.twitterHashtag,
            activeSeasons: { create: { season: process.env.SEASON } },
          };
          teamInDb = await prisma.team.create({ data: newTeam });
        }

        // Update conference/division relations
        if (conferenceIdApi) {
          const conf = await prisma.conference.findUnique({
            where: { conferenceIdApi },
            select: { id: true, name: true },
          });

          console.log(
            `fetchTeams - Adding a relation between "${teamInDb.abbreviation}" and "${conf.name}"`
          );

          await prisma.teamConference.create({
            data: {
              season: process.env.SEASON,
              conference: { connect: { id: conf.id } },
              team: { connect: { id: teamInDb.id } },
            },
          });
        }

        if (divisionIdApi) {
          const div = await prisma.division.findUnique({
            where: { divisionIdApi },
            select: { id: true, name: true },
          });

          console.log(
            `fetchTeams - Adding a relation between "${teamInDb.abbreviation}" and "${div.name}"`
          );

          await prisma.teamDivision.create({
            data: {
              season: process.env.SEASON,
              division: { connect: { id: div.id } },
              team: { connect: { id: teamInDb.id } },
            },
          });
        }
      } catch ({ name, message, stack }) {
        console.error(
          `fetchTeams.teamLoop - teamId: ${team.id} | name: ${team.shortName}`
        );
        console.error(`${name}: ${message}`, stack);
      }
    }
    console.log("fetchTeam - Done");
  } catch (err) {
    console.error(`fetchTeams - Error: ${err.name}: ${err.message}`, err.stack);
  }
};

fetchTeams()
  .catch((e) => {
    throw e;
  })
  .finally(() => prisma.$disconnect());
