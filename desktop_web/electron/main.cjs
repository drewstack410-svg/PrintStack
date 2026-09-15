const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const http = require('http')
const https = require('https')
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

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'printstack-settings.json')

function getDefaultPrintJobsFolder() {
  return path.join(app.getPath('documents'), 'PrintStack')
}

function readAppSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAppSettings(next) {
  const folder = path.dirname(SETTINGS_FILE())
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(SETTINGS_FILE(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

function getConfiguredPrintJobsFolder() {
  const configured = String(readAppSettings().printJobsFolder || '').trim()
  return configured || null
}

function getPrintJobsFolder() {
  return getConfiguredPrintJobsFolder() || getDefaultPrintJobsFolder()
}

function printJobsFolderInfo() {
  const defaultPath = getDefaultPrintJobsFolder()
  const configuredPath = getConfiguredPrintJobsFolder()
  const currentPath = configuredPath || defaultPath
  return {
    defaultPath,
    configuredPath,
    currentPath,
    isDefault: !configuredPath || configuredPath === defaultPath,
  }
}

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

  ipcMain.handle('settings:getPrintJobsFolder', () => printJobsFolderInfo())

  ipcMain.handle('settings:setPrintJobsFolder', (_event, folderPath) => {
    const nextPath = String(folderPath || '').trim()
    if (!nextPath) {
      throw new Error('Choose a folder first')
    }
    fs.mkdirSync(nextPath, { recursive: true })
    const settings = readAppSettings()
    settings.printJobsFolder = nextPath
    writeAppSettings(settings)
    return printJobsFolderInfo()
  })

  ipcMain.handle('settings:resetPrintJobsFolder', () => {
    const settings = readAppSettings()
    delete settings.printJobsFolder
    writeAppSettings(settings)
    const defaultPath = getDefaultPrintJobsFolder()
    fs.mkdirSync(defaultPath, { recursive: true })
    return printJobsFolderInfo()
  })

  ipcMain.handle('settings:pickPrintJobsFolder', async (event) => {
    const win = getWindow(event)
    const current = getPrintJobsFolder()
    fs.mkdirSync(current, { recursive: true })
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Choose print folder',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true, ...printJobsFolderInfo() }
    }

    const nextPath = result.filePaths[0]
    fs.mkdirSync(nextPath, { recursive: true })
    const settings = readAppSettings()
    settings.printJobsFolder = nextPath
    writeAppSettings(settings)
    return { canceled: false, ...printJobsFolderInfo() }
  })

  ipcMain.handle('settings:openPrintJobsFolder', async () => {
    const folder = getPrintJobsFolder()
    fs.mkdirSync(folder, { recursive: true })
    const error = await shell.openPath(folder)
    if (error) {
      throw new Error(error)
    }
    return { ok: true, path: folder }
  })

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    const target = String(url || '').trim()
    if (!/^https?:\/\//i.test(target)) {
      throw new Error('Only http(s) links can be opened')
    }
    await shell.openExternal(target)
    return { ok: true }
  })

  ipcMain.handle('files:openJobPdf', async (_event, payload = {}) => {
    const jobId = String(payload.jobId || '').trim()
    const fileUrl = String(payload.fileUrl || '').trim()
    const documentName = String(payload.documentName || 'document.pdf').trim()
    const preferredPath = String(payload.localPath || '').trim()

    let localPath = preferredPath
    if (!localPath || !fs.existsSync(localPath)) {
      if (!fileUrl) {
        throw new Error('No local PDF is available for this job')
      }
      localPath = await downloadPdfForPrint(fileUrl, documentName, {
        jobId,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        createdAt: payload.createdAt,
      })
    }

    const error = await shell.openPath(localPath)
    if (error) {
      throw new Error(error)
    }
    return { ok: true, localPath }
  })

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

  ipcMain.handle('printers:printPdf', async (event, payload = {}) => {
    const deviceName = String(payload.deviceName || '').trim()
    const fileUrl = String(payload.fileUrl || '').trim()
    if (!deviceName) {
      throw new Error('Select a printer first')
    }
    if (!fileUrl) {
      throw new Error('Print file is missing')
    }

    const trackId = String(payload.trackId || `track-${Date.now()}`)
    const documentName = String(payload.documentName || `Printstack-${Date.now()}`)
    const copies = Math.max(1, Math.min(50, Number(payload.copies) || 1))
    let savedFile = ''

    try {
      sendJobStatus(event.sender, {
        trackId,
        status: 'printing',
        rawStatus: 'Downloading PDF',
      })

      savedFile = await downloadPdfForPrint(fileUrl, documentName, {
        jobId: trackId,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        createdAt: payload.createdAt,
      })

      sendJobStatus(event.sender, {
        trackId,
        status: 'printing',
        rawStatus: 'Submitting to Windows print queue',
      })

      await printPdfFile({
        filePath: savedFile,
        printerName: String(payload.printerName || deviceName),
        deviceName,
        copies,
      })

      sendJobStatus(event.sender, {
        trackId,
        status: 'printing',
        rawStatus: 'In Windows print queue',
      })

      watchPrintJob({
        sender: event.sender,
        trackId,
        deviceName,
        documentName,
      })

      return { ok: true, trackId, status: 'printing', savedPath: savedFile, localPath: savedFile }
    } catch (error) {
      sendJobStatus(event.sender, {
        trackId,
        status: 'failed',
        rawStatus: error.message,
      })
      throw error
    }
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
    value.includes('rustdesk') ||
    value.includes('teamviewer') ||
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

function loadUrl(win, url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PDF load timed out')), 45000)
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout)
      resolve()
    })
    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timeout)
      reject(new Error(description || 'Could not load PDF'))
    })
    win.loadURL(url)
  })
}

function safeFolderSegment(value, fallback = 'Unknown') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

function formatJobDateFolder(value) {
  const date = value ? new Date(value) : new Date()
  const resolved = Number.isNaN(date.getTime()) ? new Date() : date
  const year = resolved.getFullYear()
  const month = String(resolved.getMonth() + 1).padStart(2, '0')
  const day = String(resolved.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveDownloadFolder({ customerName = '', customerEmail = '', createdAt = '' } = {}) {
  const dateFolder = formatJobDateFolder(createdAt)
  const customerFolder = safeFolderSegment(
    customerName || customerEmail,
    'Unknown customer',
  )
  const folder = path.join(getPrintJobsFolder(), dateFolder, customerFolder)
  fs.mkdirSync(folder, { recursive: true })
  return folder
}

function downloadPdfForPrint(
  fileUrl,
  documentName,
  { jobId = '', customerName = '', customerEmail = '', createdAt = '' } = {},
) {
  const folder = resolveDownloadFolder({ customerName, customerEmail, createdAt })

  const safeJobId = String(jobId || '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80)
  const safeName = String(documentName || 'document.pdf')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
  const fileName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`
  const dest = safeJobId
    ? path.join(folder, `${safeJobId}.pdf`)
    : path.join(folder, `${Date.now()}_${fileName}`)

  if (fs.existsSync(dest)) {
    try {
      if (fs.statSync(dest).size > 0) {
        return Promise.resolve(dest)
      }
    } catch {
      // Re-download below.
    }
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PDF download timed out')), 45000)

    const request = (currentUrl, redirects = 0) => {
      const lib = currentUrl.startsWith('http://') ? http : https
      const req = lib.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (redirects >= 5) {
            clearTimeout(timeout)
            reject(new Error('Too many redirects downloading PDF'))
            return
          }
          const nextUrl = new URL(res.headers.location, currentUrl).toString()
          request(nextUrl, redirects + 1)
          return
        }

        if (res.statusCode !== 200) {
          clearTimeout(timeout)
          reject(new Error(`Could not download PDF (${res.statusCode})`))
          res.resume()
          return
        }

        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            clearTimeout(timeout)
            resolve(dest)
          })
        })
        file.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      req.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    }

    request(fileUrl)
  })
}

async function printPdfFile({ filePath, printerName, deviceName, copies }) {
  const targetPrinter = printerName || deviceName
  const errors = []

  if (process.platform === 'win32') {
    try {
      await printWithPdfToPrinter(filePath, targetPrinter, copies)
      return
    } catch (error) {
      errors.push(error.message || String(error))
    }
  }

  try {
    await printWithElectron(filePath, deviceName, copies)
    return
  } catch (error) {
    errors.push(error.message || String(error))
  }

  throw new Error(
    `Could not send PDF to the printer. ${errors.filter(Boolean).join(' | ') || 'No print method worked.'}`,
  )
}

async function printWithPdfToPrinter(filePath, printerName, copies) {
  // pdf-to-printer ships SumatraPDF and does not need a Windows PDF file association.
  const { print, getPrinters } = require('pdf-to-printer')
  const available = await getPrinters()
  const wanted = String(printerName || '').trim().toLowerCase()
  const matched =
    available.find((item) => String(item.name || '').toLowerCase() === wanted) ||
    available.find((item) => String(item.name || '').toLowerCase().includes(wanted)) ||
    available.find((item) => wanted.includes(String(item.name || '').toLowerCase()))

  if (!matched?.name) {
    const names = available.map((item) => item.name).filter(Boolean).join(', ')
    throw new Error(
      `Printer "${printerName}" was not found for PDF printing${names ? `. Available: ${names}` : ''}`,
    )
  }

  await print(filePath, {
    printer: matched.name,
    copies,
    silent: true,
    scale: 'fit',
  })
}

async function printWithElectron(filePath, deviceName, copies) {
  const { pathToFileURL } = require('url')
  const preview = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  })

  try {
    await loadUrl(preview, pathToFileURL(filePath).href)
    await sleep(1200)
    for (let i = 0; i < copies; i += 1) {
      await silentPrint(preview, deviceName)
      if (i < copies - 1) {
        await sleep(600)
      }
    }
  } finally {
    if (!preview.isDestroyed()) {
      preview.close()
    }
  }
}

function silentPrint(win, deviceName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Print timed out')), 30000)
    win.webContents.print(
      {
        silent: true,
        deviceName,
        printBackground: true,
      },
      (success, failureReason) => {
        clearTimeout(timeout)
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
  let lastStatus = 'printing'
  const needle = String(documentName || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')

  while (Date.now() - started < 90_000 && !sender.isDestroyed()) {
    const jobs = await listWindowsPrintJobs(deviceName)
    const match = jobs.find((job) => {
      const name = String(job.DocumentName || '').toLowerCase()
      return (
        name.includes(needle) ||
        name.includes(String(documentName || '').toLowerCase()) ||
        name.includes('printstack') ||
        name.endsWith('.pdf')
      )
    })

    if (match) {
      seen = true
      lastStatus = normalizeJobStatus(match.JobStatus)
      sendJobStatus(sender, {
        trackId,
        status: lastStatus === 'queued' ? 'printing' : lastStatus,
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
      rawStatus: seen ? 'Complete' : 'Submitted to printer',
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
