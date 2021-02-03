/**
 * Daily script runner. Runs the fetch scripts for a single or multiple dates
 */
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const fetchGames = require("./fetchGames");
const fetchLinescores = require("./fetchLinescores");
const fetchBoxscores = require("./fetchBoxscores");
const fetchHighlights = require("./fetchHighlights");
const fetchHighlightMeta = require("./fetchHighlightMeta");
const fetchPlaybacks = require("./fetchPlaybacks");

const {
  validateDate,
  getApiData,
  contentUrl,
  liveFeedUrl,
  gamesUrl,
} = require("./fetchHelpers");

const prisma = new PrismaClient();

/**
 * Fetches all required data from the API for games that can be then used by other fetchScripts via globalThis
 * @param {Array} games Array of games from the NHL API
 */
const fetchAllApiData = async (games) => {
  const gamePks = games.map((g) => g.gamePk);
  const promises = gamePks.map((gamePk) => {
    return Promise.all([
      getApiData(contentUrl(gamePk)),
      getApiData(liveFeedUrl(gamePk)),
    ]);
  });
  const responseArr = await Promise.all(promises);
  responseArr.flat().forEach((res) => {
    const url = res.config.url;
    globalThis.__API__[url] = res;
  });
};

/**
 * Runs all daily fetch script for a date
 * @param {string} date YYYY-MM-DD
 */
const fetchDate = async (date) => {
  console.log(`fetchDate - Fetch started for date ${date}`);
  const url = gamesUrl(date);
  const games = await getApiData(url);
  if (!games.data.dates.length) {
    console.log(`fetchDate - No games available on date ${date}`);
    return;
  }

  globalThis.__API__ = {};
  globalThis.__API__[url] = games;
  await fetchAllApiData(games.data.dates[0].games);
  await fetchGames(date);
  await fetchLinescores({ fetchMode: "FLAG" });
  await fetchBoxscores({ fetchMode: "FLAG" });
  await fetchHighlights({ fetchMode: "FLAG" });
  await fetchHighlightMeta({ fetchMode: "FLAG" });
  await fetchPlaybacks({ fetchMode: "FLAG" });
  console.log(`fetchDate - Fetch completed for date ${date}`);
};

/**
 * Fetches data for many dates
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
const fetchManyDates = async (startDate, endDate) => {
  const _startDate = new Date(startDate);
  const _endDate = new Date(endDate);
  const difference = (_endDate - _startDate) / (1000 * 60 * 60 * 24);

  for (let i = 0; i <= difference; i++) {
    const date = new Date(_startDate);
    date.setDate(date.getDate() + i);
    const dateToFetch = date.toISOString().slice(0, 10);
    await fetchDate(dateToFetch);
  }
};

if (require.main === module) {
  const mode = process.argv[2];
  const startDate = process.argv[3];
  const endDate = process.argv[4];

  if (mode !== "SINGLE" && mode !== "MULTI") {
    throw new Error(`Allowed modes are: SINGLE, MULTI. Provided: ${mode}`);
  }

  if (mode === "SINGLE" && startDate) {
    validateDate(startDate);
  }

  if (mode === "MULTI") {
    validateDate(startDate);
    validateDate(endDate);
  }

  const timeYesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

  // construct current date in YYYY-MM-DD format
  const UTC_DATE = timeYesterday.toISOString().split("T")[0];
  const date = startDate || UTC_DATE;

  switch (mode) {
    case "SINGLE":
      fetchDate(date)
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          prisma.$disconnect();
          process.exit(0);
        });
      break;
    case "MULTI":
      fetchManyDates(startDate, endDate)
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          prisma.$disconnect();
          process.exit(0);
        });
      break;
    default:
      throw new Error("Case not handled. Allowed modes: SINGLE, MULTI");
  }
}

module.exports = fetchDate;
