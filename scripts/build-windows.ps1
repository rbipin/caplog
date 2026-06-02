<#
.SYNOPSIS
    Build the DayLog Tauri app for Windows with automatic prerequisite checks
    and Visual Studio Developer environment setup.

.DESCRIPTION
    This script:
      1. Verifies required toolchains are installed (Rust, Node.js, pnpm).
         Optionally installs missing tools via winget when -InstallMissing is set.
      2. Locates a usable Visual Studio install that contains the full Desktop
         x64 MSVC + Windows SDK (i.e. has msvcrt.lib in lib\x64\). Installs that
         only contain the OneCore subset are skipped because Rust's linker
         requires the standard Desktop CRT.
      3. Loads vcvars64.bat into the current process so `link.exe` can find
         msvcrt.lib / kernel32.lib / ucrt.lib.
      4. Runs `pnpm install` (only if node_modules is missing or -ForceInstall).
      5. Runs `pnpm tauri build` and prints the produced artifact paths.

    Tested on Windows 10 / 11 with Visual Studio 2019, 2022, and the standalone
    Build Tools.

.PARAMETER InstallMissing
    Install missing prerequisites (Rust, Node.js, pnpm) via winget. Visual
    Studio / MSVC Build Tools are never auto-installed - the script will print
    a download link instead because the install is large and interactive.

.PARAMETER ForceInstall
    Always run `pnpm install` even if node_modules already exists.

.PARAMETER SkipBuild
    Run all prerequisite checks and load the VS environment, but do not run
    `pnpm tauri build`. Useful for diagnosing the environment.

.EXAMPLE
    ./scripts/build-windows.ps1

.EXAMPLE
    ./scripts/build-windows.ps1 -InstallMissing

.NOTES
    Run from the repository root, or from anywhere - the script locates its
    own folder and cd's into the repo root automatically.
#>

[CmdletBinding()]
param(
    [switch]$InstallMissing,
    [switch]$ForceInstall,
    [switch]$SkipBuild
)

# Stop on the first unhandled error so we don't fall through to a misleading build attempt.
$ErrorActionPreference = 'Stop'

# Resolve the repo root from the script's own location so the script works regardless of cwd.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir

# ---------- Logging helpers ----------
function Write-Step($msg)    { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-WarnMsg($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-ErrMsg($msg)  { Write-Host "  [X]  $msg" -ForegroundColor Red }

# ---------- 1. Prerequisite checks ----------

# Check whether a command is on PATH and return $true/$false.
function Test-Command($name) {
    $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# Install a winget package if -InstallMissing is set; otherwise instruct the user.
function Install-Tool($displayName, $wingetId, $checkCmd) {
    if (Test-Command $checkCmd) {
        Write-Ok "$displayName found ($((Get-Command $checkCmd).Source))"
        return
    }
    if ($InstallMissing) {
        Write-WarnMsg "$displayName not found - installing via winget ($wingetId)..."
        winget install --id $wingetId --silent --accept-source-agreements --accept-package-agreements
        # Refresh PATH for the current process so the newly installed tool is visible immediately.
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('Path', 'User')
        if (-not (Test-Command $checkCmd)) {
            throw "$displayName install completed but '$checkCmd' is still not on PATH. Restart your shell and retry."
        }
        Write-Ok "$displayName installed"
    }
    else {
        throw "$displayName not found. Re-run with -InstallMissing or install manually: winget install $wingetId"
    }
}

Write-Step 'Checking prerequisites'
Install-Tool 'Rust (cargo)' 'Rustlang.Rustup' 'cargo'
Install-Tool 'Node.js'      'OpenJS.NodeJS'   'node'

# pnpm is special-cased: it ships with corepack on modern Node, but most setups still need a global install.
if (-not (Test-Command 'pnpm')) {
    if ($InstallMissing) {
        Write-WarnMsg 'pnpm not found - installing via npm'
        npm install -g pnpm
        if (-not (Test-Command 'pnpm')) { throw 'pnpm install failed.' }
        Write-Ok 'pnpm installed'
    }
    else {
        throw "pnpm not found. Re-run with -InstallMissing, or run: npm install -g pnpm"
    }
}
else {
    Write-Ok "pnpm found ($((Get-Command pnpm).Source))"
}

# ---------- 2. Locate a usable Visual Studio install ----------

Write-Step 'Locating Visual Studio with full Desktop x64 MSVC'

# vswhere ships with all VS Installer versions and is the canonical way to enumerate installs.
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
    $vswhere = "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
}
if (-not (Test-Path $vswhere)) {
    throw "vswhere.exe not found. Install Visual Studio Build Tools (Desktop development with C++) from https://visualstudio.microsoft.com/visual-cpp-build-tools/"
}

# Enumerate every install (including Build Tools, Preview, Insiders) so we can pick a complete one.
$installs = & $vswhere -all -prerelease -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $installs) {
    # Fall back to listing every install in case the component query missed something.
    $installs = & $vswhere -all -prerelease -property installationPath
}

# Probe each install for the full Desktop x64 CRT. Some partial installs (e.g. OneCore-only
# preview builds) ship link.exe + onecore\x64\msvcrt.lib but lack the regular lib\x64\msvcrt.lib
# that Rust's MSVC target requires.
$chosen = $null
foreach ($installPath in $installs) {
    $vcvars  = Join-Path $installPath 'VC\Auxiliary\Build\vcvars64.bat'
    $vcTools = Join-Path $installPath 'VC\Tools\MSVC'

    if (-not (Test-Path $vcvars))  { Write-WarnMsg "Skipping $installPath (no vcvars64.bat)"; continue }
    if (-not (Test-Path $vcTools)) { Write-WarnMsg "Skipping $installPath (no VC\\Tools\\MSVC)"; continue }

    # Look for msvcrt.lib in the standard Desktop x64 path (NOT under onecore\).
    $hasDesktopCrt = $false
    foreach ($verDir in Get-ChildItem $vcTools -Directory) {
        $candidate = Join-Path $verDir.FullName 'lib\x64\msvcrt.lib'
        if (Test-Path $candidate) { $hasDesktopCrt = $true; break }
    }

    if (-not $hasDesktopCrt) {
        Write-WarnMsg "Skipping $installPath (only OneCore subset installed; missing Desktop x64 CRT)"
        continue
    }

    $chosen = @{ Path = $installPath; Vcvars = $vcvars }
    break
}

if (-not $chosen) {
    Write-ErrMsg 'No usable Visual Studio install found.'
    Write-Host ''
    Write-Host 'Install (or repair) the "Desktop development with C++" workload from:' -ForegroundColor Yellow
    Write-Host '  https://visualstudio.microsoft.com/visual-cpp-build-tools/' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Required component: Microsoft.VisualStudio.Component.VC.Tools.x86.x64' -ForegroundColor Yellow
    throw 'Cannot continue without a complete MSVC + Windows SDK toolchain.'
}

Write-Ok "Using VS install: $($chosen.Path)"

# ---------- 3. Load vcvars64.bat into the current process ----------

Write-Step 'Loading MSVC environment (vcvars64.bat)'

# We can't run a .bat file directly and have its env exports survive into PowerShell, so we
# spawn cmd.exe, source vcvars64.bat, dump `set`, and copy the relevant variables back into
# this process's environment block.
$envOutput = cmd /c "`"$($chosen.Vcvars)`" && set" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "vcvars64.bat failed with exit code $LASTEXITCODE`n$envOutput"
}

# Only copy variables that actually affect the linker / compiler / SDK lookup. Pulling the full
# environment back wholesale would clobber unrelated state like USERPROFILE.
$envPattern = '^(LIB|INCLUDE|LIBPATH|Path|WindowsSdkDir|VCToolsInstallDir|VCINSTALLDIR|VSINSTALLDIR|UCRTVersion|WindowsSDKLibVersion|WindowsSDKVersion|WindowsSdkBinPath|WindowsSdkVerBinPath|UniversalCRTSdkDir)='
$envOutput | Where-Object { $_ -match $envPattern } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

if (-not $env:LIB -or -not $env:INCLUDE) {
    throw 'vcvars64.bat ran but LIB/INCLUDE were not set in this process. Aborting to avoid a misleading build failure.'
}

Write-Ok "VCToolsInstallDir: $env:VCToolsInstallDir"
Write-Ok "WindowsSdkDir:     $env:WindowsSdkDir"
Write-Ok "link.exe:          $((Get-Command link.exe -ErrorAction SilentlyContinue).Source)"

# ---------- 4. pnpm install ----------

Push-Location $RepoRoot
try {
    $nodeModules = Join-Path $RepoRoot 'node_modules'
    if ($ForceInstall -or -not (Test-Path $nodeModules)) {
        Write-Step 'Running pnpm install'
        pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed (exit $LASTEXITCODE)" }
    }
    else {
        Write-Ok 'node_modules present - skipping pnpm install (use -ForceInstall to override)'
    }

    if ($SkipBuild) {
        Write-Step 'Skipping build (-SkipBuild)'
        Write-Ok 'Environment is ready. Run `pnpm tauri build` in this shell.'
        return
    }

    # ---------- 5. Tauri build ----------

    Write-Step 'Running pnpm tauri build (this can take several minutes on a cold build)'
    pnpm tauri build
    if ($LASTEXITCODE -ne 0) { throw "pnpm tauri build failed (exit $LASTEXITCODE)" }

    Write-Step 'Build succeeded - artifacts:'
    $bundleRoot = Join-Path $RepoRoot 'src-tauri\target\release\bundle'
    # List the .msi and .exe installers that Tauri produces. -ErrorAction so a missing format
    # (e.g. user disabled NSIS) just shows nothing instead of a red error.
    Get-ChildItem -Path (Join-Path $bundleRoot 'msi')  -Filter '*.msi' -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Ok $_.FullName }
    Get-ChildItem -Path (Join-Path $bundleRoot 'nsis') -Filter '*-setup.exe' -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Ok $_.FullName }
}
finally {
    Pop-Location
}
