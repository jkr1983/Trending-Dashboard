const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const logger = require("./logger");

/**
 * Creates an axios instance with retry logic and timeout.
 * Retries on network errors and 5xx responses (not 4xx — those are client errors).
 */
function createHttpClient(options = {}) {
  const client = axios.create({
    timeout: options.timeout || 10000,
    headers: { "Accept-Encoding": "gzip,deflate" },
  });

  axiosRetry(client, {
    retries: options.retries || 3,
    retryDelay: (retryCount, error) => {
      const delay = axiosRetry.exponentialDelay(retryCount);
      logger.warn(`Retry attempt ${retryCount} after ${delay}ms`, {
        url: error?.config?.url,
        status: error?.response?.status,
      });
      return delay;
    },
    retryCondition: (error) => {
      return (
        axiosRetry.isNetworkError(error) ||
        (error.response && error.response.status >= 500)
      );
    },
    onRetry: (retryCount, error, requestConfig) => {
      logger.warn(`Retrying request (attempt ${retryCount})`, {
        url: requestConfig.url,
        message: error.message,
      });
    },
  });

  return client;
}

module.exports = { createHttpClient };
