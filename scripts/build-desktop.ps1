param(
    [switch]$Sign,
    [string]$SignConfig = 'C:\Git\codesigning\sign.json'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$python = "$root/.venv/Scripts/python.exe"
if (-not (Test-Path $python)) { throw 'Run setup.bat first.' }

if ($Sign) {
    if (-not (Test-Path $SignConfig)) { throw "Signing config not found: $SignConfig" }
    $signCfg = Get-Content $SignConfig -Raw | ConvertFrom-Json
    if (-not (Test-Path $signCfg.signtool_path)) { throw "signtool not found: $($signCfg.signtool_path)" }
    # Fail fast before a long build if the YubiKey cert isn't visible.
    $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
        Where-Object { $_.Thumbprint -eq $signCfg.thumbprint }
    if (-not $cert) { throw "Signing cert $($signCfg.thumbprint) not found. Is the YubiKey inserted?" }
    Write-Host "Signing with: $($cert.Subject)"
}

function Invoke-SignFiles([string[]]$Files) {
    $digest = $signCfg.digest_algorithm
    # Batched so one signtool call covers many files (fewer PIN prompts) without
    # exceeding the command-line length limit.
    for ($i = 0; $i -lt $Files.Count; $i += 40) {
        $batch = $Files[$i..([Math]::Min($i + 39, $Files.Count - 1))]
        & $signCfg.signtool_path sign /sha1 $signCfg.thumbprint /tr $signCfg.timestamp_server `
            /td $digest /fd $digest @batch
        if ($LASTEXITCODE -ne 0) { throw 'signtool failed.' }
    }
}

# 1. Frontend static export
$previousDesktopBuild = $env:DESKTOP_BUILD
try {
    $env:DESKTOP_BUILD = '1'
    Push-Location "$root/frontend"
    try {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
} finally { $env:DESKTOP_BUILD = $previousDesktopBuild }

# 2. Backend bundle
& $python -m PyInstaller --noconfirm --clean --onedir --name scaffold-backend `
    --distpath "$root/build/backend" --workpath "$root/build/pyinstaller" `
    --specpath "$root/build" --paths "$root/backend" `
    --add-data "$root/backend/config:config" --add-data "$root/backend/templates:templates" `
    "$root/backend/desktop.py"
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
& $python "$root/scripts/smoke-desktop.py"
if ($LASTEXITCODE -ne 0) { throw 'Bundled backend smoke test failed.' }

# 3. Sign backend binaries before electron-builder packs them into the app.
if ($Sign) {
    $unsigned = Get-ChildItem "$root/build/backend/scaffold-backend" -Recurse -File -Include *.exe, *.dll, *.pyd |
        Where-Object { (Get-AuthenticodeSignature $_.FullName).Status -ne 'Valid' } |
        ForEach-Object { $_.FullName }
    Write-Host "Signing $($unsigned.Count) backend binaries..."
    if ($unsigned) { Invoke-SignFiles $unsigned }
}

# 4. Electron package. sign-hook.cjs signs the app exe, installer and portable
#    wrapper when CODESIGN_CONFIG is set.
if (Test-Path "$root/electron/dist") { Remove-Item "$root/electron/dist" -Recurse -Force }
$previousSignConfig = $env:CODESIGN_CONFIG
try {
    if ($Sign) { $env:CODESIGN_CONFIG = $SignConfig } else { $env:CODESIGN_CONFIG = $null }
    Push-Location "$root/electron"
    try {
        npm.cmd run package:win
        if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }
    } finally { Pop-Location }
} finally { $env:CODESIGN_CONFIG = $previousSignConfig }

# 5. Verify final deliverables
if ($Sign) {
    $outputs = @(Get-ChildItem "$root/electron/dist" -Filter *.exe -File) +
        @(Get-Item "$root/electron/dist/win-unpacked/Scaffold Forge.exe",
               "$root/electron/dist/win-unpacked/resources/backend/scaffold-backend.exe")
    foreach ($file in $outputs) {
        & $signCfg.signtool_path verify /pa /q $file.FullName
        if ($LASTEXITCODE -ne 0) { throw "Signature verification failed: $($file.FullName)" }
        Write-Host "  verified: $($file.Name)"
    }
}
Write-Host 'Installer and portable app are in electron/dist.'
