const { PrismaClient } = require("@prisma/client");
const { exec } = require("child_process");

const prisma = new PrismaClient();

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
