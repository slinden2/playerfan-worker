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
};
