const { PrismaClient } = require("@prisma/client");
const { exec } = require("child_process");

const prisma = new PrismaClient();

/**
 * Allows you to use exec using async/await
 * @param {string} cmd Shell command to run
 */
function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}

/**
 * League initialization script. Performs the initial fetch for an empty database.
 */
const initLeague = async () => {
  await execShellCommand("npm run fetchConferences");
  await execShellCommand("npm run fetchDivisions");
  await execShellCommand("npm run fetchTeams");
};

initLeague()
  .catch((e) => {
    throw e;
  })
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
