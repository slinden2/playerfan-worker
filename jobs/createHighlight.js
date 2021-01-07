if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { PrismaClient } = require("@prisma/client");

const { convertMMSStoSec } = require("./fetchHelpers");

const prisma = new PrismaClient();

const createHighlight = async (data, type, relationId) => {
  const highlightData = {
    type,
    videoIdApi: parseInt(data.id),
    title: data.title.trim(),
    blurb: data.blurb.trim(),
    description: data.description.trim(),
    duration: convertMMSStoSec(data.duration),
    mediaPlaybackIdApi: parseInt(data.mediaPlaybackId),
    ...(type === "CONDENSED"
      ? { gameCondensed: { connect: { id: relationId } } }
      : {}),
    ...(type === "RECAP" ? { gameRecap: { connect: { id: relationId } } } : {}),
    ...(type === "MILESTONE"
      ? { milestone: { connect: { id: relationId } } }
      : {}),
  };

  const savedHighlight = await prisma.highlight.create({ data: highlightData });
  return savedHighlight;
};

module.exports = createHighlight;
