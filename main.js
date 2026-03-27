const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { exec } = require('child_process')

// ── Paths ──────────────────────────────────────────────────────────────────
const CLAUDE_DIR    = path.join(os.homedir(), '.claude')
const SESSIONS_DIR  = path.join(CLAUDE_DIR, 'sessions')
const HISTORY_JSONL = path.join(CLAUDE_DIR, 'history.jsonl')
const SAVED_FILE    = path.join(CLAUDE_DIR, 'saved-sessions.json')
const PROJECTS_DIR  = path.join(CLAUDE_DIR, 'projects')

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: '#FAF9F6',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#D4551F',
      symbolColor: '#ffffff',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── Helpers ─────────────────────────────────────────────────────────────────
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

// ── IPC: detect session ─────────────────────────────────────────────────────
ipcMain.handle('detect-session', () => {
  // Primary: scan ~/.claude/sessions/*.json by mtime
  if (fs.existsSync(SESSIONS_DIR)) {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ f, mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)

    for (const { f } of files) {
      const data = readJson(path.join(SESSIONS_DIR, f))
      if (data?.sessionId) return { sessionId: data.sessionId, cwd: data.cwd, source: 'auto' }
    }
  }

  // Fallback: history.jsonl
  if (fs.existsSync(HISTORY_JSONL)) {
    try {
      const lines = fs.readFileSync(HISTORY_JSONL, 'utf8').split('\n').filter(Boolean)
      const entries = lines.flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })
        .filter(e => e.sessionId)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      if (entries.length) return { sessionId: entries[0].sessionId, cwd: entries[0].project, source: 'auto' }
    } catch {}
  }

  return { sessionId: null, cwd: null, source: 'manual' }
})

// ── IPC: get session stats ──────────────────────────────────────────────────
ipcMain.handle('get-stats', (_e, sessionId, cwd) => {
  const jsonlPath = findJsonl(sessionId, cwd)
  if (!jsonlPath) return { messageCount: 0, tokenUsage: {}, model: 'unknown' }

  let messageCount = 0
  let model = 'unknown'
  const tokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

  try {
    const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        messageCount++
        if (obj.model) model = obj.model
        const usage = obj.usage || obj.message?.usage
        if (usage) {
          tokenUsage.inputTokens      += usage.input_tokens || 0
          tokenUsage.outputTokens     += usage.output_tokens || 0
          tokenUsage.cacheReadTokens  += usage.cache_read_input_tokens || 0
          tokenUsage.cacheWriteTokens += usage.cache_creation_input_tokens || 0
        }
      } catch {}
    }
  } catch {}

  return { messageCount, tokenUsage, model }
})

function findJsonl(sessionId, cwd) {
  if (cwd && fs.existsSync(PROJECTS_DIR)) {
    const encoded = cwd.replace(/\\/g, '/').replace(/^\//, '').replace(':', '').replace(/\//g, '-')
    const candidate = path.join(PROJECTS_DIR, encoded, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }
  // Glob fallback
  if (fs.existsSync(PROJECTS_DIR)) {
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      const candidate = path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

// ── IPC: load saved sessions ────────────────────────────────────────────────
ipcMain.handle('load-sessions', () => {
  const data = readJson(SAVED_FILE)
  if (!data) return []
  return (data.sessions || []).sort((a, b) => b.saved_at.localeCompare(a.saved_at))
})

// ── IPC: save session ───────────────────────────────────────────────────────
ipcMain.handle('save-session', (_e, { sessionId, comment, cwd, stats, source }) => {
  try {
    const data = readJson(SAVED_FILE) || { version: 1, sessions: [] }
    data.sessions.push({
      id: sessionId,
      comment,
      saved_at: new Date().toISOString(),
      cwd,
      message_count: stats.messageCount,
      token_usage: stats.tokenUsage,
      model: stats.model,
      source
    })
    writeJsonAtomic(SAVED_FILE, data)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── IPC: delete session ─────────────────────────────────────────────────────
ipcMain.handle('delete-session', (_e, { sessionId, savedAt }) => {
  try {
    const data = readJson(SAVED_FILE) || { version: 1, sessions: [] }
    data.sessions = data.sessions.filter(s => !(s.id === sessionId && s.saved_at === savedAt))
    writeJsonAtomic(SAVED_FILE, data)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── IPC: resume session ─────────────────────────────────────────────────────
ipcMain.handle('resume-session', (_e, sessionId, cwd) => {
  const dir = cwd || os.homedir()
  exec(`start powershell.exe -NoExit -Command "cd '${dir}'; claude --resume ${sessionId}"`, { shell: true })
  return { ok: true }
})

// ── IPC: copy to clipboard ──────────────────────────────────────────────────
ipcMain.handle('copy-text', (_e, text) => {
  clipboard.writeText(text)
  return { ok: true }
})
