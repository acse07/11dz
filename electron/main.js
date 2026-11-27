const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    title: "Видеоинтервью Сапармурат",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const isAppPage = new URL(webContents.getURL()).protocol === "file:";
    callback(isAppPage && permission === "media");
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
