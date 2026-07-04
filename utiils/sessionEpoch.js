const AppSettings = require("../Creators/appSettings");

const EPOCH_KEY = "globalSessionEpoch";

async function getSessionEpoch() {
  const doc = await AppSettings.findOne({ key: EPOCH_KEY }).exec();
  return doc?.value || 0;
}

async function bumpSessionEpoch() {
  const now = Date.now();
  await AppSettings.findOneAndUpdate(
    { key: EPOCH_KEY },
    { value: now },
    { upsert: true }
  );
  return now;
}

module.exports = { getSessionEpoch, bumpSessionEpoch, EPOCH_KEY };