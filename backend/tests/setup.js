// Jest globalSetup — runs once before all test suites
module.exports = async function globalSetup() {
  process.env.NODE_ENV        = "test";
  process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
  process.env.PORT            = "3099";
  process.env.LOG_LEVEL       = "silent";
};
