const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const { createLogger } = require("./core/logger");

const logger = createLogger();
let isRunning = false;
let shouldStop = false;
let runNfseDownloadFlow;

function configurePlaywrightBrowserPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;

  if (app.isPackaged) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.resourcesPath, "playwright-browsers");
    return;
  }

  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, "..", "playwright-browsers");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 900,
    minHeight: 680,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, "ui", "index.html"));
}

function emitToUi(channel, payload) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("open-folder", async (_event, folderPath) => {
  if (!folderPath) return false;
  await shell.openPath(folderPath);
  return true;
});

ipcMain.handle("run-bot", async (_event, config) => {
  if (!runNfseDownloadFlow) {
    ({ runNfseDownloadFlow } = require("./automation/nfseBot"));
  }

  if (isRunning) {
    return { ok: false, message: "A execução já está em andamento." };
  }

  isRunning = true;
  shouldStop = false;

  try {
    await fs.mkdir(config.outputDir, { recursive: true });

    const result = await runNfseDownloadFlow({
      ...config,
      logger,
      shouldStop: () => shouldStop,
      onStatus: (message) => emitToUi("bot-status", message),
      onProgress: (progress) => emitToUi("bot-progress", progress),
      onLog: (entry) => emitToUi("bot-log", entry)
    });

    emitToUi("bot-finished", {
      ok: true,
      result
    });

    return { ok: true, result };
  } catch (error) {
    logger.error(`Falha na execução: ${error.message}`);
    emitToUi("bot-finished", {
      ok: false,
      message: error.message
    });
    return { ok: false, message: error.message };
  } finally {
    isRunning = false;
    shouldStop = false;
  }
});

ipcMain.handle("stop-bot", async () => {
  if (!isRunning) {
    return { ok: false, message: "Não há execução ativa." };
  }
  shouldStop = true;
  return { ok: true };
});

app.whenReady().then(() => {
  configurePlaywrightBrowserPath();
  ({ runNfseDownloadFlow } = require("./automation/nfseBot"));
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
