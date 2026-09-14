const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')
const { normalizePaperSizes } = require('../lib/paperSizes')

const STATUSES = new Set(['sending', 'queued', 'printing', 'printed', 'failed'])

function jobsRef(partnerId) {
  return db.collection('partners').doc(partnerId).collection('printJobs')
}

function mapJob(doc) {
  const data = doc.data() || {}
  return {
    id: doc.id,
    documentName: data.documentName || '',
    printerName: data.printerName || '',
    deviceName: data.deviceName || '',
    status: data.status || 'queued',
    rawStatus: data.rawStatus || '',
    source: data.source || 'desktop',
    fileUrl: data.fileUrl || '',
    filePath: data.filePath || '',
    paperSizeId: data.paperSizeId || '',
    paperSizeName: data.paperSizeName || '',
    copies: Number(data.copies) || 1,
    pages: Number(data.pages) || 1,
    pricePerPiece: Number(data.pricePerPiece) || 0,
    totalPrice: Number(data.totalPrice) || 0,
    customerUid: data.customerUid || '',
    customerEmail: data.customerEmail || '',
    customerName: data.customerName || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  }
}

async function partnerIdFrom(req, res) {
  const partnerId = req.profile?.partnerId
  if (!partnerId) {
    res.status(400).json({ error: 'This admin is not linked to a partner' })
    return ''
  }
  return partnerId
}

async function listPrintJobs(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  try {
    const snap = await jobsRef(partnerId).orderBy('createdAt', 'desc').limit(30).get()
    res.json({ printJobs: snap.docs.map(mapJob) })
  } catch (error) {
    console.warn('[print-jobs] list fallback', error.message)
    const snap = await jobsRef(partnerId).limit(30).get()
    const printJobs = snap.docs
      .map(mapJob)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    res.json({ printJobs })
  }
}

async function createPrintJob(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  const documentName = String(req.body.documentName || '').trim()
  const printerName = String(req.body.printerName || '').trim()
  const deviceName = String(req.body.deviceName || '').trim()
  if (!documentName || !printerName) {
    res.status(400).json({ error: 'Document name and printer are required' })
    return
  }

  const ref = jobsRef(partnerId).doc()
  const job = {
    documentName,
    printerName,
    deviceName,
    status: 'sending',
    rawStatus: '',
    source: 'desktop',
    fileUrl: '',
    filePath: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await ref.set(job)
  const snap = await ref.get()
  res.status(201).json({ printJob: mapJob(snap) })
}

async function createCustomerPrintJob(req, res) {
  const partnerId = String(req.params.partnerId || '').trim()
  if (!partnerId) {
    res.status(400).json({ error: 'Partner id is required' })
    return
  }

  const partnerSnap = await db.collection('partners').doc(partnerId).get()
  if (!partnerSnap.exists) {
    res.status(404).json({ error: 'Partner not found' })
    return
  }

  const documentName = String(req.body.documentName || '').trim()
  const fileUrl = String(req.body.fileUrl || '').trim()
  const filePath = String(req.body.filePath || '').trim()
  const paperSizeId = String(req.body.paperSizeId || '').trim()
  const copies = Math.max(1, Math.min(100, Number(req.body.copies) || 1))
  const pages = Math.max(1, Math.min(500, Number(req.body.pages) || 1))

  if (!documentName || !fileUrl || !paperSizeId) {
    res.status(400).json({ error: 'Document, file, and paper size are required' })
    return
  }

  const paperSizes = normalizePaperSizes(partnerSnap.data()?.paperSizes)
  const paperSize = paperSizes.find((item) => item.id === paperSizeId)
  if (!paperSize) {
    res.status(400).json({ error: 'Selected paper size is not available' })
    return
  }

  const pricePerPiece = Number(paperSize.pricePerPiece) || 0
  const totalPrice = Number((pricePerPiece * copies * pages).toFixed(2))
  const customerName = [req.profile?.firstName, req.profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  const ref = jobsRef(partnerId).doc()
  const job = {
    documentName,
    printerName: '',
    deviceName: '',
    status: 'queued',
    rawStatus: 'Waiting for partner desktop',
    source: 'mobile',
    fileUrl,
    filePath,
    paperSizeId: paperSize.id,
    paperSizeName: paperSize.name,
    paperWidth: paperSize.width,
    paperHeight: paperSize.height,
    paperUnit: paperSize.unit,
    copies,
    pages,
    pricePerPiece,
    totalPrice,
    customerUid: req.user.uid,
    customerEmail: req.profile?.email || req.user.email || '',
    customerName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  await ref.set(job)
  const snap = await ref.get()
  res.status(201).json({ printJob: mapJob(snap) })
}

async function updatePrintJob(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  const ref = jobsRef(partnerId).doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Print job not found' })
    return
  }

  const status = String(req.body.status || '').trim()
  if (!STATUSES.has(status)) {
    res.status(400).json({ error: 'Invalid print status' })
    return
  }

  const updates = {
    status,
    rawStatus: String(req.body.rawStatus || ''),
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (req.body.printerName) {
    updates.printerName = String(req.body.printerName)
  }
  if (req.body.deviceName) {
    updates.deviceName = String(req.body.deviceName)
  }

  await ref.update(updates)

  const updated = await ref.get()
  res.json({ printJob: mapJob(updated) })
}

module.exports = {
  listPrintJobs,
  createPrintJob,
  createCustomerPrintJob,
  updatePrintJob,
}
