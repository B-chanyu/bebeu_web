"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RELOAD_FILE = path.join(ROOT, ".server-reload");
const RESTART_DELAY_MS = 1500;

let serverProcess = null;
let restarting = false;
let restartQueued = false;
let shuttingDown = false;
let reloadTimer = null;

function buildApp() {
  const result = spawnSync(process.execPath, ["scripts/build-public-app.js"], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
  return result.status === 0;
}

function startServer() {
  const runtimeVersion = `${Date.now()}-${process.pid}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, BEBEU_RUNTIME_VERSION: runtimeVersion },
    stdio: "inherit",
  });
  serverProcess = child;
  console.log(`[managed] Server started (${runtimeVersion}).`);

  child.on("exit", (code, signal) => {
    if (serverProcess === child) serverProcess = null;
    if (shuttingDown || restarting) return;
    console.error(`[managed] Server exited (${signal || code}). Restarting...`);
    setTimeout(() => requestRestart("unexpected exit"), RESTART_DELAY_MS);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    const child = serverProcess;
    if (!child) return resolve();
    serverProcess = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once("exit", finish);
    try {
      child.kill();
    } catch {
      finish();
    }
    setTimeout(finish, 3000);
  });
}

async function restartServer(reason) {
  if (restarting) {
    restartQueued = true;
    return;
  }
  restarting = true;
  do {
    restartQueued = false;
    console.log(`[managed] Applying reload: ${reason}`);
    await stopServer();
    if (buildApp()) startServer();
    else console.error("[managed] Build failed. Waiting for the next reload request.");
  } while (restartQueued && !shuttingDown);
  restarting = false;
}

function requestRestart(reason) {
  if (shuttingDown) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => restartServer(reason), 400);
}

function ensureReloadFile() {
  if (!fs.existsSync(RELOAD_FILE)) fs.writeFileSync(RELOAD_FILE, "ready\n", "utf8");
  fs.watchFile(RELOAD_FILE, { interval: 500 }, (current, previous) => {
    if (current.mtimeMs !== previous.mtimeMs) requestRestart("requested after code update");
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(reloadTimer);
  fs.unwatchFile(RELOAD_FILE);
  await stopServer();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

ensureReloadFile();
if (buildApp()) startServer();
else console.error("[managed] Initial build failed. Run npm run reload:managed after fixing it.");
