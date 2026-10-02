$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
if (-not (Test-Path '.venv/Scripts/python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python virtual environment.' }
}
& "$root/.venv/Scripts/python.exe" -m pip install -r "$root/backend/requirements-dev.txt"
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
foreach ($directory in @('frontend', 'electron')) {
    Push-Location "$root/$directory"
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in $directory" }
    } finally { Pop-Location }
}
