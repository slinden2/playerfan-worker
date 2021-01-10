const axios = require("axios");

const generateSiteLink = (name) => {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s/, "-")
    .replace(/\s/, "-")
    .toLowerCase();
};

const isValidDate = (date) => {
  if (!/^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/.test(date)) {
    throw new Error("Invalid date argument");
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

const getApiData = async (dataSet, gamePk) => {
  const prop =
    dataSet === "content"
      ? "__CONTENT__"
      : dataSet === "livefeed"
      ? "__LIVE_FEED__"
      : undefined;
  if (!prop) {
    throw new Error(
      `Valid dataSet values: 'content', 'livefeed'. Provided: ${dataSet}`
    );
  }

  if (globalThis[prop] && globalThis[prop][gamePk]) {
    return globalThis[prop][gamePk];
  } else {
    const func =
      prop === "__CONTENT__"
        ? contentUrl
        : prop === "__LIVE_FEED__"
        ? liveFeedUrl
        : undefined;
    return await axios.get(func(gamePk));
  }
};

module.exports = {
  generateSiteLink,
  isValidDate,
  convertFtToCm,
  convertLbsToKg,
  convertMMSStoSec,
  gamesUrl,
  contentUrl,
  liveFeedUrl,
  playerUrl,
  getApiData,
  getPlayersWithoutScratches,
};
