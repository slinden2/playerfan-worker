const axios = require("axios");

/**
 * Consumes a team or player name and returns
 * it in 'firstname-lastname' format in lower case.
 * @param {string} name
 */
const generateSiteLink = (name) => {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/, "-")
    .replace(/\s/, "-")
    .toLowerCase();
};

/**
 * Check if the passed argument follows the valid format
 * @param {string} date YYYY-MM-DD
 */
const validateDate = (date) => {
  if (!/^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/.test(date)) {
    throw new Error("Invalid date argument");
  }
};

/**
 * Check if the passed argument is in valid gamePk format
 * @param {string|number} gamePk
 */
const validateGamePk = (gamePk) => {
  if (!/^20[1-9][0-9]0\d{5}$/.test(gamePk)) {
    throw new Error("Invalid gamePk");
  }
};

const convertFtToCm = (height) => {
  let [ft, inches] = height.split(" ");
  ft = ft.substring(0, ft.length - 1);
  inches = inches.substring(0, inches.length - 1);
  return Math.round(ft * 30.48 + inches * 2.54);
};

const convertLbsToKg = (weight) => {
  return Math.round(weight * 0.45359237);
};

/**
 * Converts time from mm:ss format to seconds
 * @param {string} time mm:ss
 */
const convertMMSStoSec = (time) => {
  const [mins, secs] = time.split(":");
  return parseInt(mins * 60) + parseInt(secs);
};

/**
 * Generate an url to get the games of the day
 * @param {string} date YYYY-MM-DD
 */
const gamesUrl = (date) =>
  `https://statsapi.web.nhl.com/api/v1/schedule?date=${date}`;

/**
 * Generate a content url for a gamePk
 * @param {string} gamePk
 */
const contentUrl = (gamePk) =>
  `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/content`;

/**
 * Generate a live feed url for a gamePk
 * @param {string} gamePk
 */
const liveFeedUrl = (gamePk) =>
  `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`;

/**
 * Generate a player data url for a playerId
 * @param {string} playerId
 */
const playerUrl = (playerId) =>
  `https://statsapi.web.nhl.com/api/v1/people/${playerId}`;

/**
 * Separates scratched players from skaters array.
 * @param {Array<number>} skaters Array of playerIds
 * @param {Array<number>} scratches Array of playerIds
 */
const getPlayersWithoutScratches = (skaters, scratches) => {
  return skaters.filter((playerId) => !scratches.includes(playerId));
};

/**
 * Returns all data from an API endpoint.
 * @param {string} url
 */
const getApiData = async (url) => {
  if (globalThis.__API__ && globalThis.__API__[url]) {
    console.log("Data found in globalThis");
    return globalThis.__API__[url];
  } else {
    return await axios.get(url);
  }
};

const fetchModes = ["DATE", "GAMEPK", "FLAG"];

/**
 * Check if the passed string is one of the allowed fetchModes
 * @param {string} mode String to be validated
 */
const validateFetchMode = (mode) => {
  if (!fetchModes.includes(mode)) {
    throw new Error(
      `Valid fetch modes: 'DATE', 'GAMEPK', 'FLAG'. Provided: ${mode}`
    );
  }
};

/**
 * Validates that the script is run with valid arguments.
 * @param {Array} arr Array of input arguments
 */
const validateInputArgs = (arr) => {
  validateFetchMode(arr[2]);
  const fetchMode = arr[2];

  if (fetchMode === "DATE") {
    validateDate(arr[3]);
  }

  if (fetchMode === "GAMEPK") {
    validateGamePk(arr[3]);
  }

  return { fetchMode, inputArg: arr[3] };
};

/**
 * Prints out which games are worked on
 * @param {string} funcName Name of the callee function
 * @param {Array} games Array of game objects with gamePk property
 */
const logBatch = (funcName, games) => {
  const gamePks = games.map((g) => g.gamePk);
  if (gamePks.length) {
    console.log(`${funcName} - Starting to fetch batch: ${gamePks}`);
  }
};

module.exports = {
  generateSiteLink,
  validateDate,
  validateGamePk,
  convertFtToCm,
  convertLbsToKg,
  convertMMSStoSec,
  gamesUrl,
  contentUrl,
  liveFeedUrl,
  playerUrl,
  getApiData,
  getPlayersWithoutScratches,
  validateFetchMode,
  validateInputArgs,
  logBatch,
};
