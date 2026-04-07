const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const isTest = process.env.NODE_ENV === "test";
const logLevel = process.env.LOG_LEVEL || (isTest ? "silent" : "info");

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: isTest
    ? [new winston.transports.Console({ silent: true })]
    : [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
              return `${timestamp} [${level}] ${message}${metaStr}`;
            })
          ),
        }),
        new DailyRotateFile({
          filename: "logs/combined-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxFiles: "7d",
          maxSize: "20m",
        }),
        new DailyRotateFile({
          filename: "logs/error-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "error",
          maxFiles: "14d",
          maxSize: "20m",
        }),
      ],
});

module.exports = logger;
