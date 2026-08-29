# LinuxAI 1-Click PowerShell Launcher
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir "backend\.venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    & $VenvPython (Join-Path $ScriptDir "run.py")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $ScriptDir "run.py")
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 (Join-Path $ScriptDir "run.py")
} else {
    Write-Host "`n[ERROR] Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python 3.11+ from https://www.python.org/`n" -ForegroundColor Yellow
}
