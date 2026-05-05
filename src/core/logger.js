const fs = require("fs");
const path = require("path");

function createLogger() {
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const file = path.join(
    logsDir,
    `run-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
  );

  const append = (level, message) => {
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    fs.appendFileSync(file, line, "utf8");
  };

  return {
    file,
    info: (msg) => append("INFO", msg),
    warn: (msg) => append("WARN", msg),
    error: (msg) => append("ERROR", msg)
  };
}

module.exports = { createLogger };
