function validateEnv() {
  const required = ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Server will not start without these — check your .env / deployment config.`
    );
  }
}

module.exports = validateEnv;