// A portable NSIS launcher cannot expose Playwright's Electron main-process pipe.
// Connect to Chromium after extraction instead, using a temporary test profile.
const { chromium } = require("playwright-core");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const profile = await fs.mkdtemp(path.resolve(__dirname, "../build/portable-smoke-"));
  const version = require("./package.json").version;
  const executable = path.join(__dirname, "dist", `Scaffold Forge-${version}-x64-portable.exe`);
  const env = { ...process.env, PATH: path.join(process.env.SystemRoot, "System32") };
  for (const key of ["ELECTRON_RUN_AS_NODE", "PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"]) delete env[key];
  const child = spawn(executable, ["--remote-debugging-port=0", `--user-data-dir=${profile}`],
    { cwd: profile, env, windowsHide: true, stdio: "ignore" });
  let browser;
  let spawnError;
  child.on("error", (error) => { spawnError = error; });
  try {
    let debugPort;
    for (let attempt = 0; attempt < 240; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Portable launcher exited (${child.exitCode})`);
      try {
        debugPort = (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        break;
      } catch { await delay(250); }
    }
    assert.ok(debugPort, "Portable app did not start Chromium within 60 seconds");
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.waitForEvent("page");
    await page.getByText("What is this project?", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByText("Wolf Processing Pipeline", { exact: true }).waitFor();
    const backendUrl = new URL(page.url()).origin;
    const response = await fetch(`${backendUrl}/api/options`);
    assert.ok((await response.json()).steps.length);
    const cdp = await browser.newBrowserCDPSession();
    await Promise.race([cdp.send("Browser.close").catch(() => {}), delay(2000)]);
    for (let attempt = 0; attempt < 80 && child.exitCode === null; attempt++) await delay(250);
    assert.equal(child.exitCode, 0, "Portable launcher did not exit cleanly");
    await assert.rejects(fetch(`${backendUrl}/health`));
    console.log("PASS: portable extraction, launch without Python/Node on PATH, wizard, templates, and shutdown");
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(2000)]);
    if (child.pid && child.exitCode === null) {
      await new Promise((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        killer.on("exit", resolve);
        killer.on("error", resolve);
      });
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
