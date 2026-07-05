// Minimal Electron shell for shipping Nightfall Swarm as a desktop build
// (Steam et al). The game itself is untouched web code loaded from ../.
//
// Ship it with electron-builder or electron-packager:
//   cd electron && npm install && npm start          # dev run
//   npx electron-builder --dir                       # unpacked build
//
// NOTE: authored as standard boilerplate; run `npm start` locally to verify
// before shipping — this repo's CI only tests the browser build.
const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0a12",
    fullscreenable: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon-512.png"),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
