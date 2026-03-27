// ── Elements ────────────────────────────────────────────────────────────────
const sessionInput  = document.getElementById('session-id')
const commentInput  = document.getElementById('comment')
const dot           = document.getElementById('dot')
const dotLabel      = document.getElementById('dot-label')
const btnRedetect   = document.getElementById('btn-redetect')
const btnSave       = document.getElementById('btn-save')
const statusMsg     = document.getElementById('status-msg')
const rowsContainer = document.getElementById('rows')

let detectedCwd    = null
let detectedSource = 'manual'

// ── Auto-detect on load ──────────────────────────────────────────────────────
async function detect() {
  dot.className = 'dot amber'
  dotLabel.textContent = 'Detecting…'
  sessionInput.placeholder = 'Auto-detecting…'

  const result = await window.api.detectSession()

  if (result.sessionId) {
    sessionInput.value     = result.sessionId
    detectedCwd            = result.cwd
    detectedSource         = result.source
    dot.className          = 'dot green'
    dotLabel.textContent   = 'Auto-detected'
    sessionInput.placeholder = ''
  } else {
    sessionInput.value     = ''
    detectedCwd            = null
    detectedSource         = 'manual'
    dot.className          = 'dot amber'
    dotLabel.textContent   = 'Enter session ID manually'
    sessionInput.placeholder = 'Paste session UUID here…'
  }
}

btnRedetect.addEventListener('click', detect)

// ── Save ─────────────────────────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const sessionId = sessionInput.value.trim()
  const comment   = commentInput.value.trim()

  if (!sessionId) { showStatus('Session ID is required', 'red'); return }
  if (!comment)   { showStatus('Comment is required', 'red'); return }

  btnSave.disabled = true

  const stats  = await window.api.getStats(sessionId, detectedCwd)
  const result = await window.api.saveSession({
    sessionId, comment,
    cwd: detectedCwd,
    stats,
    source: detectedSource
  })

  if (result.ok) {
    showStatus('Session saved!', 'green')
    commentInput.value = ''
    await loadSessions()
  } else {
    showStatus('Error saving session', 'red')
  }

  btnSave.disabled = false
})

commentInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnSave.click() })

// ── Load & render sessions ───────────────────────────────────────────────────
async function loadSessions() {
  const sessions = await window.api.loadSessions()
  rowsContainer.innerHTML = ''

  if (!sessions.length) {
    rowsContainer.innerHTML = `
      <div class="empty-state">
        No saved sessions yet.<br>
        <span class="hint">Save your first session using the form above.</span>
      </div>`
    return
  }

  for (const s of sessions) {
    rowsContainer.appendChild(buildRow(s))
  }
}

function buildRow(s) {
  const row = document.createElement('div')
  row.className = 'row'

  const dateStr = formatDate(s.saved_at)
  const idShort = s.id ? s.id.slice(0, 8) + '…' : '—'
  const msgs    = s.message_count || '—'
  const resumeCmd = `claude --resume ${s.id}`

  const u = s.token_usage || {}
  const totalTokens = (u.inputTokens || 0) + (u.outputTokens || 0)
  const tokenTip = totalTokens
    ? `Model: ${s.model || 'unknown'}\nInput:  ${(u.inputTokens || 0).toLocaleString()}\nOutput: ${(u.outputTokens || 0).toLocaleString()}\nTotal:  ${totalTokens.toLocaleString()}`
    : 'No token data'

  row.innerHTML = `
    <div class="col-comment" title="${esc(s.comment)}">${esc(s.comment)}</div>
    <div class="col-date">${dateStr}</div>
    <div class="col-id" title="${esc(s.id)}">${idShort}</div>
    <div class="col-msgs" title="${esc(tokenTip)}">${msgs}</div>
    <div class="col-actions">
      <button class="btn-resume" data-id="${esc(s.id)}">▶ Resume</button>
      <button class="btn-copy"   data-cmd="${esc(resumeCmd)}">⎘ Copy</button>
      <button class="btn-delete" data-id="${esc(s.id)}" data-at="${esc(s.saved_at)}">✕</button>
    </div>
  `

  row.querySelector('.btn-resume').addEventListener('click', async () => {
    await window.api.resumeSession(s.id, s.cwd)
  })

  row.querySelector('.btn-copy').addEventListener('click', async (e) => {
    await window.api.copyText(resumeCmd)
    const btn = e.currentTarget
    const orig = btn.textContent
    btn.textContent = '✓ Copied'
    setTimeout(() => { btn.textContent = orig }, 1800)
  })

  row.querySelector('.btn-delete').addEventListener('click', async () => {
    const confirmed = confirm(`Delete this session?\n\n"${s.comment}"\n${s.id.slice(0, 20)}…`)
    if (!confirmed) return
    await window.api.deleteSession({ sessionId: s.id, savedAt: s.saved_at })
    await loadSessions()
    showStatus('Session deleted', 'muted')
  })

  return row
}

// ── Utilities ────────────────────────────────────────────────────────────────
function showStatus(msg, type = '') {
  statusMsg.textContent = msg
  statusMsg.className   = `status-msg ${type}`
  clearTimeout(statusMsg._timer)
  statusMsg._timer = setTimeout(() => {
    statusMsg.textContent = ''
    statusMsg.className   = 'status-msg'
  }, 3000)
}

function formatDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    })
  } catch { return iso?.slice(0, 16) || '—' }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Dark mode toggle ──────────────────────────────────────────────────────────
const btnTheme  = document.getElementById('btn-theme')
const themeIcon = btnTheme.querySelector('.theme-icon')
const themeLabel = btnTheme.querySelector('.theme-label')

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
  themeIcon.textContent  = dark ? '☀️' : '🌙'
  themeLabel.textContent = dark ? 'Light' : 'Dark'
}

const savedDark = localStorage.getItem('theme') === 'dark'
applyTheme(savedDark)

btnTheme.addEventListener('click', () => {
  const isDark = !document.documentElement.classList.contains('dark')
  applyTheme(isDark)
  localStorage.setItem('theme', isDark ? 'dark' : 'light')
})

// ── Init ─────────────────────────────────────────────────────────────────────
detect()
loadSessions()
