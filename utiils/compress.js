const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");

async function processVideo(buffer, originalname) {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${Date.now()}-${originalname}`);
  const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);

  await fs.promises.writeFile(inputPath, buffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime("00:00:00")
      .duration(180)
      .videoCodec("libx264")
      .outputOptions("-crf 28")
      .size("?x720")
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  const outputBuffer = await fs.promises.readFile(outputPath);

  await fs.promises.unlink(inputPath);
  await fs.promises.unlink(outputPath);

  return outputBuffer;
}

const sharp = require("sharp");

async function compressImage(buffer) {
  const compressedBuffer = await sharp(buffer)
    .resize({ width: 1080, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return compressedBuffer;
}

module.exports = {
  compressImage,
  processVideo,
};
