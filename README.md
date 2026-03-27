# Claude Session Saver

A lightweight Windows desktop app for saving and resuming [Claude Code](https://claude.ai/code) sessions.

---

## The Problem

Claude Code does have a built-in resume feature. You can run `claude --resume <id>` or use `/resume` interactively inside an active session. The problem is that neither gives you a way to *label* sessions or find them later by what you were working on.

In practice this means: you finish a debugging session on Monday, context-switch to something else on Wednesday, and by Friday you have no idea which UUID in `~/.claude/projects/` corresponds to the auth work you want to pick back up. You either dig through JSONL files sorted by timestamp, scroll through the interactive `/resume` picker hoping something looks familiar, or give up and start a fresh session, losing all the context Claude had built up.

This app adds the missing labeling layer. Save a session with a human-readable note at any meaningful point. Come back later, see your note, and resume with one click.

![Claude Session Saver](https://github.com/user-attachments/assets/4fee2470-f69d-41b6-a830-cb9a4760b83a)

---

## Features

- **Auto-detects** your current Claude Code session ID from `~/.claude/`
- **Save sessions** with a comment so you remember what you were working on
- **Resume** any saved session in a new PowerShell window, pointed at the right project directory
- **Copy** the resume command to paste into your own terminal (VS Code, Windows Terminal, etc.)
- **Token usage tooltip** on each session showing input, output, and total token counts
- **Light and dark mode** with your preference remembered between launches

---

## Download

Go to [Releases](../../releases) and download the latest `Claude-Session-Saver-win-x64.zip`.

Extract the zip anywhere and run `Claude Session Saver.exe`. No installation required.

> **Windows SmartScreen warning:** Windows may show a "Windows protected your PC" warning because the app is not code-signed. Click **More info** then **Run anyway**. The app only reads files inside `~/.claude/` and writes to `~/.claude/saved-sessions.json`.

---

## Requirements

- Windows 10 or later (x64)
- [Claude Code CLI](https://claude.ai/code) installed and available in your PATH

---

## How It Works

On launch, the app scans `~/.claude/sessions/` and `~/.claude/history.jsonl` to find your most recent session ID. You add a comment and hit **Save Session**.

Saved sessions are stored in `~/.claude/saved-sessions.json`. Each entry includes the session ID, your comment, the project directory, message count, token usage, and the model used.

When you click **Resume**, the app opens PowerShell, navigates to your project directory, and runs:

```
claude --resume <session-id>
```

---

## Building from Source

```bash
git clone https://github.com/musaib5/claude-session-saver.git
cd claude-session-saver
npm install
npm start
```

To build the distributable zip:

```bash
npm run build
```

> Note: `npm run build` requires Windows Developer Mode enabled (Settings > System > For Developers) due to a symlink limitation in electron-builder's code signing tools. If Developer Mode is off, the `dist/win-unpacked/` folder is still built correctly and can be zipped manually.

---

## FAQ

**Will this break my Claude sessions?**
No. The app only reads existing files that Claude Code writes. It saves its own data to `~/.claude/saved-sessions.json` and does not touch any other Claude files.

**Why does it say "No conversation found" when I resume?**
The resume command must run from the same directory the session was created in. The app handles this automatically when you use the Resume button. If you use the Copy button, make sure to run the command from your project directory.

**Why does Windows flag the exe?**
The app is not code-signed. A trusted code signing certificate costs ~$200-400/year. The app is fully open source so you can inspect every line of code before running it.

**Where is my saved sessions data stored?**
At `~/.claude/saved-sessions.json`. You can open, edit, or delete this file at any time.

---

## Limitations

- Windows only (x64)
- Token counts are captured at the time you save the session. If you resume and continue working, the saved count will not update
- Search is label-only. The app searches your notes, not the actual conversation content
- Not affiliated with Anthropic

---

## License

MIT
