# Setup OpenCode CLI for current user
# This script configures the CLI so that 'opencode' launches the TUI in your terminal.

# Requires: OpenCode Desktop installed (which includes opencode-cli.exe)

$ErrorActionPreference = 'Stop'

# 1. Locate opencode-cli.exe
$openCodeDir = Join-Path $env:LOCALAPPDATA 'OpenCode'
$cliPath = Join-Path $openCodeDir 'opencode-cli.exe'
if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: opencode-cli.exe not found at $cliPath" -ForegroundColor Red
    Write-Host "Please ensure OpenCode Desktop is installed." -ForegroundColor Yellow
    exit 1
}
Write-Host "Found opencode-cli.exe at $cliPath"

# 2. Check for existing opencode command (optional warning)
$existing = Get-Command opencode -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "WARNING: 'opencode' command already points to $($existing.Source)" -ForegroundColor Yellow
    Write-Host "This script will create a new command that may override it after terminal restart." -ForegroundColor Yellow
}

# 3. Clean up any leftover files in OpenCode directory
$oldBatch = Join-Path $openCodeDir 'opencode.bat'
if (Test-Path $oldBatch) {
    Remove-Item $oldBatch -Force
    Write-Host "Removed old batch file $oldBatch"
}
$oldSymlink = Join-Path $openCodeDir 'opencode'
if (Test-Path $oldSymlink) {
    Remove-Item $oldSymlink -Force
    Write-Host "Removed old symlink $oldSymlink"
}

# 4. Prepare bin directory
$binDir = Join-Path $env:USERPROFILE '.local\bin'
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    Write-Host "Created directory $binDir"
}

# 5. Create symlink or batch file
$symlinkPath = Join-Path $binDir 'opencode'
$batchPath = Join-Path $binDir 'opencode.bat'

# Try symlink first
try {
    if (Test-Path $symlinkPath) {
        Write-Host "Symlink already exists at $symlinkPath"
    } else {
        New-Item -ItemType SymbolicLink -Path $symlinkPath -Target $cliPath -ErrorAction Stop | Out-Null
        Write-Host "Created symlink $symlinkPath -> $cliPath"
    }
} catch {
    Write-Host "Symlink creation failed (may require admin privileges). Falling back to batch file."
    # Remove any existing symlink
    if (Test-Path $symlinkPath) { Remove-Item $symlinkPath -Force }
    # Create batch file
    if (-not (Test-Path $batchPath)) {
        @"
@echo off
set OPENCODE_CLIENT=
"$cliPath" %*
"@ | Out-File -FilePath $batchPath -Encoding ASCII
        Write-Host "Created batch file $batchPath"
    } else {
        Write-Host "Batch file already exists at $batchPath"
    }
}

# 6. Add bin directory to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$paths = $userPath -split ';' | Where-Object { $_ -ne '' }
$binDirInPath = $paths -contains $binDir
if (-not $binDirInPath) {
    $newPath = ($paths + $binDir) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Added $binDir to user PATH."
} else {
    Write-Host "$binDir already in user PATH."
}

# 7. Remove OpenCode directory from user PATH to avoid conflict with desktop app
$openCodeDirInPath = $paths -contains $openCodeDir
if ($openCodeDirInPath) {
    $filteredPaths = $paths | Where-Object { $_ -ne $openCodeDir }
    $newPath = $filteredPaths -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Removed $openCodeDir from user PATH."
}

# 8. Set OPENCODE_CLIENT environment variable
[Environment]::SetEnvironmentVariable('OPENCODE_CLIENT', 'cli', 'User')
Write-Host "Set OPENCODE_CLIENT=cli for user."

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "Please restart your terminal for changes to take effect." -ForegroundColor Yellow
Write-Host "Then run 'opencode --version' to verify."