const { _electron: electron } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const profile = await fs.mkdtemp(path.join(root, "build", "ui-smoke-"));
  const env = { ...process.env, PATH: path.join(process.env.SystemRoot, "System32") };
  for (const key of ["ELECTRON_RUN_AS_NODE", "PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"]) delete env[key];
  let application;
  try {
    application = await electron.launch({
      executablePath: path.join(__dirname, "dist", "win-unpacked", "Scaffold Forge.exe"),
      args: [`--user-data-dir=${profile}`], cwd: profile, env, timeout: 60000,
    });
    const userData = await application.evaluate(({ app }) => app.getPath("userData"));
    assert.equal(path.resolve(userData), path.resolve(profile), "Smoke test must use an isolated profile");
    const page = await application.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByText("What is this project?", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByText("Wolf Processing Pipeline", { exact: true }).click();
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByRole("button", { name: "Save Current Config", exact: true }).click();
    await page.getByPlaceholder("Template name...").fill("Packaged UI smoke");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Packaged UI smoke", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Hide Templates", exact: true }).click();
    await page.getByRole("button", { name: /Review & Generate/ }).click();
    const generate = page.getByRole("button", { name: "Generate Scaffold", exact: true });
    await generate.waitFor();
    assert.equal(await generate.isEnabled(), true);
    const zipPath = path.join(profile, "scaffold.zip");
    await application.evaluate(({ session }, destination) => {
      globalThis.desktopSmokeDownload = new Promise((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), 15000);
        session.defaultSession.once("will-download", (_event, item) => {
          item.setSavePath(destination);
          item.once("done", (_event, state) => { clearTimeout(timer); resolve(state); });
        });
      });
    }, zipPath);
    await generate.click();
    assert.equal(await application.evaluate(() => globalThis.desktopSmokeDownload), "completed");
    assert.equal((await fs.readFile(zipPath)).subarray(0, 2).toString(), "PK");
    // Visual constraint enforcement: Docker is flagged once the target is Electron.
    await page.getByRole("button", { name: /Stack & Framework/ }).click();
    await page.getByText("Electron (Desktop)", { exact: true }).click();
    await page.getByRole("button", { name: /Infrastructure/ }).click();
    await page.getByText("blocked", { exact: true }).first().waitFor();
    // Settings, appearance and the configuration editor render.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), false);
    await page.getByRole("button", { name: "Open configuration editor", exact: true }).click();
    await page.getByRole("tab", { name: /Constraints/ }).click();
    await page.getByText("electron-no-docker", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, "build", "desktop-smoke.png") });
    assert.deepEqual(errors, []);
    const backendUrl = new URL(page.url()).origin;
    await application.close();
    application = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await fetch(`${backendUrl}/health`); }
      catch { console.log("PASS: packaged window, template saving, ZIP download, constraint badges, settings, config editor, and backend shutdown"); return; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Backend remained alive after closing the desktop app");
  } finally {
    if (application) await application.close();
    // Keep the isolated profile and screenshot under ignored build/ for inspection.
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
