# OpenCode CLI Setup Scripts

This repository contains scripts to configure the OpenCode CLI (from the OpenCode Desktop installation) so that you can run `opencode` in your terminal to launch the TUI.

## Problem

When you install OpenCode Desktop, the CLI (`opencode-cli.exe`) is placed in `C:\Users\<you>\AppData\Local\OpenCode\` alongside the desktop app executable (`OpenCode.exe`). If you add this directory to your PATH, typing `opencode` may launch the desktop app instead of the terminal UI because Windows finds the desktop app first.

## Solution

These scripts:
1. **Locate** the `opencode-cli.exe` from your OpenCode Desktop installation
2. **Create** a symlink (or batch file fallback) named `opencode` in a dedicated bin directory
3. **Add** that bin directory to your user PATH
4. **Remove** the OpenCode Desktop directory from your PATH to prevent conflicts
5. **Set** the `OPENCODE_CLIENT=cli` environment variable

## Usage

### Method 1: Run the batch file (recommended)

Double-click `setup-opencode.bat` or run it from any terminal:
```batch
setup-opencode.bat
```

### Method 2: Run PowerShell directly

```powershell
powershell -ExecutionPolicy Bypass -File setup-opencode.ps1
```

## After Setup

**Restart your terminal** (Git‑Bash, CMD, PowerShell) for the PATH changes to take effect.

Then verify:
```bash
opencode --version   # Should show version 1.2.27 or newer
opencode             # Should launch the OpenCode TUI in your terminal
```

## What Gets Created

- **`~/.local/bin/opencode`** – Symlink to `opencode-cli.exe` (or `opencode.bat` if symlinks fail)
- **`~/.local/bin` directory** – Added to your user PATH
- **Environment variable** – `OPENCODE_CLIENT=cli` set for your user account

## Requirements

- OpenCode Desktop must be installed (the script looks for `opencode-cli.exe` in `%LOCALAPPDATA%\OpenCode\`)
- Administrator privileges are **not** required (the script uses a batch file fallback if symlinks fail)

## Uninstallation

To remove the setup:
1. Delete `~\.local\bin\opencode` (or `opencode.bat`)
2. Remove `~\.local\bin` from your user PATH
3. Delete the `OPENCODE_CLIENT` user environment variable

## Troubleshooting

**Desktop app still launches when typing `opencode`?**
- Ensure you restarted your terminal after running the script
- Check that `where opencode` (CMD/PowerShell) or `which opencode` (Git‑Bash) points to `~\.local\bin\opencode`
- The script removes the OpenCode Desktop directory from PATH, but some shells may cache the old PATH; restart the shell completely

**Symlink creation fails?**
- The script automatically creates a batch file wrapper instead, which works identically
- No admin privileges needed for batch file method

**Want to use the CLI from a different directory?**
- The script sets up the CLI globally; you can run `opencode` from any directory
- To use a specific project directory, run `opencode /path/to/project` or `cd` into the project first