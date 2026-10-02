const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");
const http = require("http");

let mainWindow;
let backendProcess;
let frontendProcess;
let appPort;
let quitting = false;
let logStream;

const isDev = !app.isPackaged;

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  const vars = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        vars[key.trim()] = rest.join("=").trim();
      }
    }
  }
  return vars;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortFree(start + i)) return start + i;
  }
  throw new Error(`No free port in range ${start}-${start + maxAttempts - 1}`);
}

function getResourcePath(subpath) {
  if (isDev) {
    return path.join(__dirname, "..", subpath);
  }
  return path.join(process.resourcesPath, subpath);
}

async function waitForHttp(url, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (backendProcess && backendProcess.exitCode !== null) throw new Error("Backend stopped during startup.");
    const ready = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => req.destroy(new Error("Request timed out")));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function startBackend(port) {
  const backendDir = getResourcePath("backend");
  const pythonCmd = path.join(__dirname, "..", ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(pythonCmd)) throw new Error("Run setup.bat first to create the project virtual environment.");

  backendProcess = spawn(pythonCmd, ["-m", "uvicorn", "app.main:app", "--port", String(port)], {
    cwd: backendDir,
    stdio: isDev ? "inherit" : "pipe",
    windowsHide: true,
    env: { ...process.env, BACKEND_PORT: String(port) },
  });

  backendProcess.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
}

function startPackagedBackend() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    logStream = fs.createWriteStream(path.join(app.getPath("userData"), "desktop.log"), { flags: "a" });
    logStream.on("error", (error) => console.error("Cannot write desktop log:", error));
    backendProcess = spawn(getResourcePath("backend/scaffold-backend.exe"), [
      "--frontend", getResourcePath("frontend"),
    ], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, SCAFFOLD_DATA_DIR: app.getPath("userData") },
    });
    backendProcess.stderr.pipe(logStream, { end: false });
    let buffer = "";
    let receivedPort = false;
    const timer = setTimeout(() => reject(new Error("Backend did not report its port.")), 60000);
    backendProcess.stdout.on("data", (chunk) => {
      logStream.write(chunk);
      if (receivedPort) return;
      buffer += chunk.toString();
      const newline = buffer.indexOf("\n");
      if (newline !== -1) {
        try {
          const { port } = JSON.parse(buffer.slice(0, newline));
          if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid backend port");
          clearTimeout(timer);
          receivedPort = true;
          resolve(port);
        } catch (error) { clearTimeout(timer); reject(error); }
      }
    });
    backendProcess.once("error", (error) => { clearTimeout(timer); reject(error); });
    backendProcess.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Backend exited (${code}).`));
      if (!quitting && mainWindow) {
        dialog.showErrorBox("Scaffold Forge", "The local backend stopped. Please restart the app. Details are in desktop.log in the app data folder.");
        app.quit();
      }
    });
  });
}

function startFrontend(port, backendPort) {
  const frontendDir = getResourcePath("frontend");

  if (isDev) {
    const env = {
      ...process.env,
      BACKEND_URL: `http://localhost:${backendPort}`,
      BACKEND_PORT: String(backendPort),
      FRONTEND_PORT: String(port),
    };
    // Same launch as scripts/dev.py. A quoted `cmd /c "cd /d ..."` string gets
    // re-escaped by Node on Windows and cmd rejects it, so rely on cwd instead.
    frontendProcess = spawn(`npm run dev -- --port ${Number(port)}`, {
      cwd: frontendDir,
      stdio: "inherit",
      env,
      windowsHide: true,
      shell: true,
    });
  }
}

async function createWindow(frontendPort) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Scaffold Forge",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== `http://127.0.0.1:${frontendPort}`) event.preventDefault();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(`http://127.0.0.1:${frontendPort}`);
}

// Folder picker / opener for Settings → Custom Templates.
ipcMain.handle("pick-folder", async (_event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose custom templates folder",
    defaultPath: typeof defaultPath === "string" ? defaultPath : undefined,
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("open-folder", async (_event, folder) => {
  if (typeof folder !== "string" || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return "Folder not found";
  return shell.openPath(folder);
});

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on("second-instance", () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

if (hasLock) app.whenReady().then(async () => {
  if (!isDev) {
    appPort = await startPackagedBackend();
    await waitForHttp(`http://127.0.0.1:${appPort}/health`);
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    await createWindow(appPort);
    return;
  }
  const env = loadEnv();
  const preferredBackend = parseInt(env.BACKEND_PORT || "8000", 10);
  const preferredFrontend = parseInt(env.FRONTEND_PORT || "3000", 10);

  const backendPort = await findFreePort(preferredBackend);
  const frontendPort = await findFreePort(preferredFrontend);

  if (backendPort !== preferredBackend) {
    console.log(`[port] Backend port ${preferredBackend} in use, using ${backendPort}`);
  }
  if (frontendPort !== preferredFrontend) {
    console.log(`[port] Frontend port ${preferredFrontend} in use, using ${frontendPort}`);
  }

  console.log(`[electron] Backend  → http://localhost:${backendPort}`);
  console.log(`[electron] Frontend → http://localhost:${frontendPort}`);

  startBackend(backendPort);
  startFrontend(frontendPort, backendPort);

  console.log("[electron] Waiting for backend...");
  await waitForHttp(`http://127.0.0.1:${backendPort}/health`);
  console.log("[electron] Waiting for frontend to compile...");
  await waitForHttp(`http://127.0.0.1:${frontendPort}`);

  appPort = frontendPort;
  await createWindow(appPort);
}).catch((error) => {
  dialog.showErrorBox("Scaffold Forge could not start", `${error.message}\n\n${isDev ? "Check the terminal output." : `Log: ${path.join(app.getPath("userData"), "desktop.log")}`}`);
  app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  for (const child of [backendProcess, frontendProcess]) {
    if (!child || !child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on("error", () => child.kill());
    } else child.kill();
  }
});
app.on("window-all-closed", () => app.quit());

app.on("activate", () => {
  if (mainWindow === null && appPort) createWindow(appPort);
});
