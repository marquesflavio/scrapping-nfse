const fs = require("fs/promises");
const path = require("path");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[<>:"/\\|?*]+/g, "_").replace(/\s+/g, " ").trim();
}

function buildXmlName({ pageIndex, rowIndex, emittedFor, generatedAt }) {
  const generated = (generatedAt || "").replace(/[^\d]/g, "") || "sem_data";
  const emitted = sanitizeFileName(emittedFor || "sem_destinatario").slice(0, 80);
  return `NFSE_P${pageIndex}_R${rowIndex}_${generated}_${emitted}.xml`;
}

async function waitForAndSaveDownload({
  page,
  outputDir,
  fileName,
  triggerDownload,
  timeoutMs = 30000
}) {
  const downloadPromise = page.waitForEvent("download", { timeout: timeoutMs });
  if (typeof triggerDownload === "function") {
    await triggerDownload();
  }
  const download = await downloadPromise;
  const targetPath = path.join(outputDir, fileName);
  await download.saveAs(targetPath);
  return targetPath;
}

module.exports = {
  ensureDir,
  buildXmlName,
  waitForAndSaveDownload
};
