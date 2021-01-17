const axios = require("axios");

const generateSiteLink = (name) => {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/, "-")
    .replace(/\s/, "-")
    .toLowerCase();
};

const validateDate = (date) => {
  if (!/^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/.test(date)) {
    throw new Error("Invalid date argument");
  }
};

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

const convertMMSStoSec = (time) => {
  const [mins, secs] = time.split(":");
  return parseInt(mins * 60) + parseInt(secs);
};

const gamesUrl = (date) =>
  `https://statsapi.web.nhl.com/api/v1/schedule?date=${date}`;

const contentUrl = (gamePk) =>
  `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/content`;

const liveFeedUrl = (gamePk) =>
  `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`;

const playerUrl = (playerId) =>
  `https://statsapi.web.nhl.com/api/v1/people/${playerId}`;

const getPlayersWithoutScratches = (skaters, scratches) => {
  return skaters.filter((playerId) => !scratches.includes(playerId));
};

const getApiData = async (url) => {
  if (globalThis.__API__ && globalThis.__API__[url]) {
    console.log("Data found in globalThis");
    return globalThis.__API__[url];
  } else {
    return await axios.get(url);
  }
};

const fetchModes = ["DATE", "GAMEPK", "FLAG"];
const validateFetchMode = (mode) => {
  if (!fetchModes.includes(mode)) {
    throw new Error(
      `Valid fetch modes: 'DATE', 'GAMEPK', 'FLAG'. Provided: ${mode}`
    );
  }
};

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
