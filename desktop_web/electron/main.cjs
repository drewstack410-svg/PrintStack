const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

const isDev = !app.isPackaged
const DEV_SERVER_URL = 'http://localhost:5173'

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) {
    return
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      continue
    }

    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile()

const googleApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
if (googleApiKey) {
  app.commandLine.appendSwitch('google-api-key', googleApiKey)
}
app.commandLine.appendSwitch('enable-features', 'Geolocation,WinrtGeolocationImplementation')

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Printstack',
    backgroundColor: '#0b1117',
    show: false,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  if (isDev) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('maximize', () => {
    win.webContents.send('window:maximized', true)
  })
  win.on('unmaximize', () => {
    win.webContents.send('window:maximized', false)
  })
}

function allowLocationPermission(permission) {
  return permission === 'geolocation' || permission === 'fullscreen' || permission === 'clipboard-sanitized-write'
}

async function lookupNetworkLocation() {
  const response = await fetch('https://ipwho.is/')
  const data = await response.json()
  const latitude = Number(data?.latitude)
  const longitude = Number(data?.longitude)
  if (!data?.success || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Could not detect this computer’s location')
  }

  return {
    latitude,
    longitude,
    label: [data.city, data.region, data.country].filter(Boolean).join(', '),
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => allowLocationPermission(permission))
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowLocationPermission(permission))
  })

  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
  }))

  ipcMain.handle('window:minimize', (event) => {
    getWindow(event)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = getWindow(event)
    if (!win) {
      return false
    }
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle('window:close', (event) => {
    getWindow(event)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => Boolean(getWindow(event)?.isMaximized()))

  ipcMain.handle('location:current', () => lookupNetworkLocation())

  ipcMain.handle('printers:list', async (event) => {
    const win = getWindow(event)
    if (!win) {
      return []
    }
    const list = await win.webContents.getPrintersAsync()
    return (Array.isArray(list) ? list : []).filter((printer) => !isVirtualPrinter(printer))
  })

  ipcMain.handle('printers:testPrint', async (event, payload = {}) => {
    const deviceName = String(payload.deviceName || '').trim()
    if (!deviceName) {
      throw new Error('Select a printer first')
    }

    const trackId = String(payload.trackId || `track-${Date.now()}`)
    const documentName = String(payload.documentName || `Printstack-test-${Date.now()}`)
    const preview = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    })

    const html = buildTestPrintHtml({ ...payload, documentName })
    await loadHtml(preview, html)

    try {
      await silentPrint(preview, deviceName)
      await sleep(1500)
    } catch (error) {
      sendJobStatus(event.sender, {
        trackId,
        status: 'failed',
        rawStatus: error.message,
      })
      throw error
    } finally {
      if (!preview.isDestroyed()) {
        preview.close()
      }
    }

    sendJobStatus(event.sender, { trackId, status: 'queued', rawStatus: 'Submitted' })
    watchPrintJob({
      sender: event.sender,
      trackId,
      deviceName,
      documentName,
    })
    return { ok: true, trackId, status: 'queued' }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function isVirtualPrinter(printer) {
  const value = `${printer?.name || ''} ${printer?.displayName || ''}`.toLowerCase()
  return (
    value.includes('anydesk') ||
    value.includes('pdf') ||
    value.includes('xps') ||
    value.includes('onenote') ||
    value.includes('fax')
  )
}

function loadHtml(win, html) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Print preview timed out')), 15000)
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout)
      resolve()
    })
    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timeout)
      reject(new Error(description || 'Could not load print page'))
    })
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}

function silentPrint(win, deviceName) {
  return new Promise((resolve, reject) => {
    win.webContents.print(
      {
        silent: true,
        deviceName,
        printBackground: true,
      },
      (success, failureReason) => {
        if (success) {
          resolve(true)
          return
        }
        reject(new Error(failureReason || 'Print failed'))
      },
    )
  })
}

function sendJobStatus(sender, payload) {
  if (!sender.isDestroyed()) {
    sender.send('printers:jobStatus', payload)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeJobStatus(value) {
  const status = String(value || '').toLowerCase()
  if (!status) {
    return 'queued'
  }
  if (status.includes('error') || status.includes('paperout') || status.includes('offline') || status.includes('blocked')) {
    return 'failed'
  }
  if (status.includes('printed') || status.includes('complete') || status.includes('deleted')) {
    return 'printed'
  }
  if (status.includes('printing')) {
    return 'printing'
  }
  return 'queued'
}

async function listWindowsPrintJobs(printerName) {
  if (process.platform !== 'win32') {
    return []
  }

  const escaped = String(printerName || '').replace(/'/g, "''")
  const command = `Get-PrintJob -PrinterName '${escaped}' | Select-Object Id, DocumentName, JobStatus | ConvertTo-Json -Compress`
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout: 15000 },
    )
    const trimmed = String(stdout || '').trim()
    if (!trimmed) {
      return []
    }
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

async function watchPrintJob({ sender, trackId, deviceName, documentName }) {
  const started = Date.now()
  let seen = false
  let lastStatus = 'queued'

  while (Date.now() - started < 90_000 && !sender.isDestroyed()) {
    const jobs = await listWindowsPrintJobs(deviceName)
    const match = jobs.find((job) => {
      const name = String(job.DocumentName || '')
      return name.includes(documentName) || name.toLowerCase().includes('printstack')
    })

    if (match) {
      seen = true
      lastStatus = normalizeJobStatus(match.JobStatus)
      sendJobStatus(sender, {
        trackId,
        status: lastStatus,
        rawStatus: String(match.JobStatus || ''),
        printerJobId: match.Id,
      })
      if (lastStatus === 'printed' || lastStatus === 'failed') {
        return
      }
    } else if (seen) {
      sendJobStatus(sender, {
        trackId,
        status: lastStatus === 'failed' ? 'failed' : 'printed',
        rawStatus: lastStatus === 'failed' ? 'Error' : 'Complete',
      })
      return
    }

    await sleep(800)
  }

  if (!sender.isDestroyed()) {
    sendJobStatus(sender, {
      trackId,
      status: seen && lastStatus !== 'failed' ? 'printed' : lastStatus,
      rawStatus: seen ? 'Complete' : 'Not printed',
    })
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTestPrintHtml(payload = {}) {
  const companyName = escapeHtml(payload.companyName || 'Printstack')
  const printerName = escapeHtml(payload.printerName || payload.deviceName || 'Unknown printer')
  const printedAt = escapeHtml(new Date().toLocaleString())
  const documentName = escapeHtml(payload.documentName || 'Printstack test print')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${documentName}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0B1220; margin: 48px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .muted { color: #5B6475; margin: 0 0 24px; }
      .box { border: 2px solid #7C5CFF; border-radius: 12px; padding: 24px; }
      .row { margin: 8px 0; }
      .label { color: #5B6475; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
      .value { font-size: 18px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Printstack test print</h1>
    <p class="muted">If you can read this page, the selected printer is working.</p>
    <div class="box">
      <div class="row"><div class="label">Partner</div><div class="value">${companyName}</div></div>
      <div class="row"><div class="label">Printer</div><div class="value">${printerName}</div></div>
      <div class="row"><div class="label">Printed at</div><div class="value">${printedAt}</div></div>
    </div>
  </body>
</html>`
}
