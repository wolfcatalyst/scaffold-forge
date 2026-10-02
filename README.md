# Scaffold Forge — Wolf Edition

An opinionated app scaffolding tool that surfaces every architectural decision upfront — before you write a single line of code. No more shoehorning auth, storage, AI providers, or Docker configs into a project after the fact.

Walk through a guided wizard, pick your stack, and generate a ready-to-go project scaffold with validation, constraint checking, and war stories from real projects baked in.

## How It Works

1. **Project Intent** — What are you building? Prototype, SaaS, internal tool, desktop app?
2. **Data Lifecycle** — Does data need to persist? Do users come back? Need search/query?
3. **Stack Selection** — Backend, frontend, database, auth, AI, infra, tooling — all driven by your answers
4. **Constraint Validation** — Conflicting options are flagged as you pick them, with one-click fixes (e.g., SaaS with no auth, shadcn without React)
5. **Generate** — Download a zip with your full project scaffold, ready to build. Its README lists every choice you made (the *Scaffold Spec*) and opens with a note asking whichever AI assistant you use to flag missing dependencies. The Review step can also copy the whole plan as a ready-made review prompt for any AI assistant.

## Quick Start

### Windows desktop app (standalone)

Use either file from `electron/dist`:

- `Scaffold Forge-1.0.0-x64-nsis.exe`: guided installer, with Start menu and desktop shortcuts. Installs for the current user by default.
- `Scaffold Forge-1.0.0-x64-portable.exe`: double-click to run without installing. It extracts its bundled files on launch, so the first window can take a few seconds.

Both include Electron, the Python runtime and backend dependencies, and the compiled frontend. Users do not need Python, Node.js, npm, Docker, or an internet connection to run the wizard and generate scaffolds. Generated projects have their own dependencies.

Saved templates, settings, Forge Configuration changes, custom templates and `desktop.log` are stored in `%APPDATA%/scaffold-forge`, outside the installation folder. The portable version also uses this profile folder; it does not keep data beside the executable. Source-checkout templates are not migrated automatically; export/import custom templates through the app if needed.

`build-desktop.bat` produces unsigned builds, so Windows may show an unknown-publisher warning; `build-desktop-signed.bat` signs them (see below). Windows x64 is the supported desktop build target; macOS/Linux packaging has not been implemented or verified.

### Build the Windows packages

On a Windows x64 development machine with Python 3.12 and Node.js/npm installed:

1. Run `setup.bat` once. It creates `.venv`, installs Python build/test dependencies there, and installs frontend/Electron dependencies using the npm lockfiles.
2. Run `build-desktop.bat`. It exports the frontend, bundles the backend with PyInstaller, runs a standalone smoke test, then creates both executables in `electron/dist`.
3. Run `start-forge.bat` for development (uses `.venv` and the Next.js development server).

To produce code-signed builds, plug in the YubiKey and run `build-desktop-signed.bat` instead of step 2. It reads the certificate thumbprint and timestamp server from `C:\Git\codesigning\sign.json`, signs the bundled backend binaries before packaging, lets electron-builder sign the app, installer and portable executables via `electron/sign-hook.cjs`, then verifies every signature.

Dependency installation and the first build need internet access (including font and packaging-tool downloads). The resulting app runs locally: the backend binds an available loopback port and serves both the UI and API. Closing the app stops the backend.

Verification commands, from the repository root:

```powershell
.venv/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider
.venv/Scripts/python.exe scripts/smoke-desktop.py
.venv/Scripts/python.exe scripts/smoke-desktop.py --resources electron/dist/win-unpacked/resources
npm --prefix electron run test:packaged
node electron/smoke-portable.cjs
```

The UI smoke test launches the packaged app in an isolated profile under `build/`, checks template saving and ZIP download, then closes it. A screenshot is saved to `build/desktop-smoke.png`. The portable smoke test also checks extraction, launch, and shutdown through the portable executable itself.

### Local Development (recommended)

```bash
# Clone and setup
cp .env.example .env
python -m venv .venv
source .venv/bin/activate # Windows PowerShell: .venv/Scripts/Activate.ps1
pip install -r backend/requirements-dev.txt
cd frontend && npm install && cd ..

# Run (auto-finds free ports)
make dev
```

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Then open `http://localhost:3000`, or `http://<server-ip>:3000` from another device on your network.

> **Internal use only:** there is no login. Anyone who can reach the port can use the app and change its configuration. Keep it on a trusted network or behind a VPN such as Tailscale, and don't expose it to the internet. The compose file runs in development mode (hot reload), which is fine for occasional use.

### Electron (desktop app)

After setting up `.venv` and the frontend dependencies above (Windows: `setup.bat`):

```bash
cd electron && npm install && npm run dev
```

## Project Structure

```
scaffold-forge/
  backend/           # FastAPI + constraint engine + scaffold generator
    app/
      api/routes/    # REST endpoints (options, validate, scaffold, templates, config, settings)
      core/          # Models, constraints, generator, forge config, settings (no framework deps)
    config/          # Built-in JSON config (options, steps, constraints)
    templates/       # Jinja2 templates for every generated file
  frontend/          # Next.js + shadcn/ui wizard
    src/
      components/wizard/   # Step components (Intent, DataLifecycle, DynamicStep, Review, Settings)
      components/forge/    # Forge Configuration editor (steps, option groups, constraints)
      lib/                 # API client, default config, client-side constraint checks, appearance
  electron/          # Electron shell (spawns backend + frontend)
  scripts/           # Dev launcher with port auto-detection
```

## Configuration

The wizard is entirely data-driven. Customize it from **Settings → Forge Configuration**: add, edit and reorder steps, create option groups with a live preview, build constraints with a condition editor, and import/export configuration packs. Changes are saved to the data folder (`%APPDATA%/scaffold-forge` for the desktop app, `backend/data/` when running from source or Docker), so updates never overwrite them and **Reset to defaults** is always available.

The built-in defaults are three JSON files you can also edit by hand:

| File | Purpose |
|---|---|
| `backend/config/options.json` | Option groups and their choices (what appears in each step) |
| `backend/config/steps.json` | Wizard pages and which option groups they contain |
| `backend/config/constraints.json` | Validation rules with conditions, severity, and war stories |

**Adding a new option** to an existing group — add an entry in `options.json`:
```json
{ "id": "rust", "label": "Rust" }
```

**Adding a new wizard page** — add a step in `steps.json`:
```json
{
  "id": "monitoring",
  "label": "Monitoring",
  "type": "options",
  "option_groups": ["monitoring"]
}
```

Most option groups support `allow_other: true` for free-text custom entries.

## Generated files and custom templates

Every generated file comes from a Jinja2 template in `backend/templates/`, named after the output path plus `.j2` (for example `backend/app/main.py.j2`). To override one, drop a file with the same relative path into the `custom_templates` folder shown in **Settings → Custom Templates**. The folder is created automatically, per Windows user, and you can move it anywhere (the desktop app has a folder picker). Templates receive the full config: `stack`, `intent`, `data_lifecycle`, `project_name`, every flat field, `ai_providers`, `spec` and `constraint_results`. The Review step's AI prompt comes from `_ai_prompt.md.j2` and can be overridden the same way.

## Ports

Default ports are configured in `.env` (or in **Settings → Port Configuration** when running from source):

```
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

When running with `make dev` or Electron dev mode, ports auto-increment if already in use. The packaged desktop app always picks a free port by itself. With Docker, these values set the host port mappings.

## Built-in Templates

Four Wolf templates come pre-loaded:

- **Wolf SaaS** — Full-stack SaaS with JWT auth, PostgreSQL, Redis, Docker, CI/CD
- **Wolf Internal Tool** — Team dashboard with API key auth, SQLite, minimal infra
- **Wolf Pipeline** — Data processing pipeline, no frontend, no auth, queue-based
- **Wolf Desktop** — Electron app with local SQLite, no Docker

Save, load, export, and import your own templates from the sidebar.

## Constraint Engine

Constraints are JSON rules that fire when your config matches certain conditions. Each has:

- **Severity** — `hard` (blocks generation), `error` and `warn` (flagged in the wizard), `info` (shown on Review)
- **Condition** — every field must match: a value, a list (any of), or `{"not": ...}`
- **Then** — optional `require` / `set` / `suggest` values that power the one-click **Fix** button, and `hide` to hide option groups
- **War story** — Real-world context for why this matters

While you pick options, each choice is checked ahead of time: options that would break a hard rule are greyed out, and ones that would cause an error or warning get a badge explaining why.

---

## License

Scaffold Forge is source-available under the **MIT License with the Commons Clause** (see [LICENSE](LICENSE)).

- **Allowed:** personal use, and using it as a tool in your own business; modifying, forking and sharing it, as long as the license stays intact.
- **Not allowed:** selling it, or offering it as a paid hosted service or paid support whose value comes mainly from this software.
- **Your generated projects are yours.** The scaffolds Scaffold Forge generates aren't covered by this license; use them however you like.

If these terms don't fit what you need, open an issue on the repo and we'll work something out.
