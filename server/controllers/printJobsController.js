const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')
const { isLocationOnline } = require('../lib/location')
const { normalizePaperSizes } = require('../lib/paperSizes')
const {
  jobReferenceFields,
  writeStatusEvent,
} = require('../services/printJobCrossReferences')

const STATUSES = new Set([
  'awaiting_payment',
  'sending',
  'queued',
  'printing',
  'printed',
  'failed',
  'cancelled',
])

function jobsRef(partnerId) {
  return db.collection('partners').doc(partnerId).collection('printJobs')
}

function randomOrderNumber() {
  return String(Math.floor(10000000 + Math.random() * 90000000))
}

async function allocateOrderNumber(partnerId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const orderNumber = randomOrderNumber()
    const existing = await jobsRef(partnerId).where('orderNumber', '==', orderNumber).limit(1).get()
    if (existing.empty) {
      return orderNumber
    }
  }
  // Extremely unlikely fallback — still 8 digits from timestamp tail.
  return String(Date.now()).slice(-8)
}

function normalizeDocument(raw = {}, index = 0) {
  const pages = Math.max(1, Math.min(500, Number(raw.pages) || 1))
  let bwPages = Math.max(0, Number(raw.bwPages) || 0)
  let colorPages = Math.max(0, Number(raw.colorPages) || 0)
  if (bwPages + colorPages <= 0) {
    if (raw.colorMode === 'color') {
      colorPages = pages
      bwPages = 0
    } else if (raw.colorMode === 'mixed') {
      bwPages = 0
      colorPages = 0
    } else {
      bwPages = pages
      colorPages = 0
    }
  }

  const colorMode =
    raw.colorMode === 'color' || raw.colorMode === 'mixed'
      ? raw.colorMode
      : colorPages > 0 && bwPages > 0
        ? 'mixed'
        : colorPages > 0
          ? 'color'
          : 'bw'

  return {
    id: String(raw.id || `doc-${index + 1}`),
    documentName: String(raw.documentName || '').trim(),
    fileUrl: String(raw.fileUrl || '').trim(),
    filePath: String(raw.filePath || '').trim(),
    paperSizeId: String(raw.paperSizeId || '').trim(),
    paperSizeName: String(raw.paperSizeName || '').trim(),
    paperWidth: Number(raw.paperWidth) || 0,
    paperHeight: Number(raw.paperHeight) || 0,
    paperUnit: String(raw.paperUnit || 'in'),
    copies: Math.max(1, Math.min(100, Number(raw.copies) || 1)),
    pages,
    bwPages,
    colorPages,
    colorMode,
    forceBlackAndWhite: raw.forceBlackAndWhite === true,
    priceBw: Number(raw.priceBw) || 0,
    priceColor: Number(raw.priceColor) || 0,
    pricePerPiece: Number(raw.pricePerPiece) || 0,
    totalPrice: Number(raw.totalPrice) || 0,
    localPath: String(raw.localPath || ''),
    status: STATUSES.has(raw.status) ? raw.status : '',
  }
}

function documentsFromData(data = {}) {
  if (Array.isArray(data.documents) && data.documents.length > 0) {
    return data.documents.map((item, index) => normalizeDocument(item, index))
  }

  // Legacy single-document jobs.
  if (data.documentName || data.fileUrl) {
    return [
      normalizeDocument(
        {
          id: 'doc-1',
          documentName: data.documentName,
          fileUrl: data.fileUrl,
          filePath: data.filePath,
          paperSizeId: data.paperSizeId,
          paperSizeName: data.paperSizeName,
          paperWidth: data.paperWidth,
          paperHeight: data.paperHeight,
          paperUnit: data.paperUnit,
          copies: data.copies,
          pages: data.pages,
          bwPages: data.bwPages,
          colorPages: data.colorPages,
          colorMode: data.colorMode,
          priceBw: data.priceBw,
          priceColor: data.priceColor,
          pricePerPiece: data.pricePerPiece,
          totalPrice: data.totalPrice,
          localPath: data.localPath,
        },
        0,
      ),
    ]
  }

  return []
}

function aggregateFromDocuments(documents) {
  const pages = documents.reduce((sum, doc) => sum + (Number(doc.pages) || 0), 0)
  const bwPages = documents.reduce((sum, doc) => sum + (Number(doc.bwPages) || 0), 0)
  const colorPages = documents.reduce((sum, doc) => sum + (Number(doc.colorPages) || 0), 0)
  const copies = documents.reduce((sum, doc) => sum + (Number(doc.copies) || 0), 0)
  const totalPrice = Number(
    documents.reduce((sum, doc) => sum + (Number(doc.totalPrice) || 0), 0).toFixed(2),
  )
  const first = documents[0] || {}
  const documentCount = documents.length
  const documentName =
    documentCount <= 1
      ? first.documentName || ''
      : `${first.documentName || 'Document'} +${documentCount - 1} more`

  const colorMode =
    colorPages > 0 && bwPages > 0 ? 'mixed' : colorPages > 0 ? 'color' : 'bw'

  return {
    documentName,
    documentCount,
    fileUrl: first.fileUrl || '',
    filePath: first.filePath || '',
    paperSizeId: first.paperSizeId || '',
    paperSizeName: first.paperSizeName || '',
    copies: copies || 1,
    pages: pages || 1,
    bwPages,
    colorPages,
    colorMode,
    priceBw: Number(first.priceBw) || 0,
    priceColor: Number(first.priceColor) || 0,
    pricePerPiece: Number(first.pricePerPiece) || 0,
    totalPrice,
    localPath: first.localPath || '',
  }
}

function mapJob(doc) {
  const data = doc.data() || {}
  const documents = documentsFromData(data)
  const aggregates = aggregateFromDocuments(documents)
  const convenienceFee = Math.max(0, Number(data.convenienceFee) || 0)
  const totalPrice = Number(
    (
      (Number.isFinite(Number(data.totalPrice))
        ? Number(data.totalPrice)
        : aggregates.totalPrice + convenienceFee)
    ).toFixed(2),
  )

  return {
    id: doc.id,
    partnerId: data.partnerId || doc.ref.parent.parent?.id || '',
    printJobId: data.printJobId || doc.id,
    printJobPath: data.printJobPath || doc.ref.path,
    customerPath: data.customerPath || '',
    paymentPath: data.paymentPath || '',
    orderNumber: String(data.orderNumber || doc.id).padStart(8, '0').slice(-8),
    documentName: aggregates.documentName,
    documentCount: aggregates.documentCount,
    documents,
    printerName: data.printerName || '',
    deviceName: data.deviceName || '',
    status: data.status || 'queued',
    rawStatus: data.rawStatus || '',
    source: data.source || 'desktop',
    fileUrl: aggregates.fileUrl,
    filePath: aggregates.filePath,
    paperSizeId: aggregates.paperSizeId,
    paperSizeName: aggregates.paperSizeName,
    copies: aggregates.copies,
    pages: aggregates.pages,
    bwPages: aggregates.bwPages,
    colorPages: aggregates.colorPages,
    colorMode: aggregates.colorMode,
    pricePerPiece: aggregates.pricePerPiece,
    priceBw: aggregates.priceBw,
    priceColor: aggregates.priceColor,
    convenienceFee,
    totalPrice,
    localPath: aggregates.localPath,
    customerUid: data.customerUid || '',
    customerEmail: data.customerEmail || '',
    customerName: data.customerName || '',
    paymentStatus: data.paymentStatus || '',
    paymentIntentId: data.paymentIntentId || '',
    isReservation: data.isReservation === true,
    reservationStatus: data.reservationStatus || '',
    cancelledAt: data.cancelledAt?.toDate?.()?.toISOString?.() || null,
    paidAt: data.paidAt?.toDate?.()?.toISOString?.() || null,
    printingStartedAt: data.printingStartedAt?.toDate?.()?.toISOString?.() || null,
    completedAt: data.completedAt?.toDate?.()?.toISOString?.() || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  }
}

function buildPricedDocument(raw, paperSizes, index) {
  const documentName = String(raw.documentName || '').trim()
  const fileUrl = String(raw.fileUrl || '').trim()
  const filePath = String(raw.filePath || '').trim()
  const paperSizeId = String(raw.paperSizeId || '').trim()
  const copies = Math.max(1, Math.min(100, Number(raw.copies) || 1))
  const pages = Math.max(1, Math.min(500, Number(raw.pages) || 1))
  const rawBw = Number(raw.bwPages)
  const rawColor = Number(raw.colorPages)
  const hasPageSplit = Number.isFinite(rawBw) || Number.isFinite(rawColor)
  let bwPages = Number.isFinite(rawBw) ? Math.max(0, Math.min(500, rawBw)) : 0
  let colorPages = Number.isFinite(rawColor) ? Math.max(0, Math.min(500, rawColor)) : 0
  const requestedMode = String(raw.colorMode || '').toLowerCase()

  if (!hasPageSplit) {
    if (requestedMode === 'color') {
      colorPages = pages
      bwPages = 0
    } else {
      bwPages = pages
      colorPages = 0
    }
  } else {
    const counted = bwPages + colorPages
    if (counted <= 0) {
      bwPages = pages
      colorPages = 0
    } else if (counted !== pages) {
      const scale = pages / counted
      bwPages = Math.round(bwPages * scale)
      colorPages = Math.max(0, pages - bwPages)
    }
  }

  const colorMode =
    colorPages > 0 && bwPages > 0 ? 'mixed' : colorPages > 0 ? 'color' : 'bw'

  if (!documentName || !fileUrl || !paperSizeId) {
    throw new Error('Each document needs a file and paper size')
  }

  const paperSize = paperSizes.find((item) => item.id === paperSizeId)
  if (!paperSize) {
    throw new Error(`Paper size not available for ${documentName}`)
  }

  const priceBw = Number(paperSize.priceBw ?? paperSize.pricePerPiece) || 0
  const priceColor = Number(paperSize.priceColor) || 0
  const pricePerPiece =
    colorMode === 'color' ? priceColor : colorMode === 'mixed' ? 0 : priceBw
  const totalPrice = Number(
    ((bwPages * priceBw + colorPages * priceColor) * copies).toFixed(2),
  )

  return normalizeDocument(
    {
      id: `doc-${index + 1}`,
      documentName,
      fileUrl,
      filePath,
      paperSizeId: paperSize.id,
      paperSizeName: paperSize.name,
      paperWidth: paperSize.width,
      paperHeight: paperSize.height,
      paperUnit: paperSize.unit,
      copies,
      pages,
      bwPages,
      colorPages,
      colorMode,
      forceBlackAndWhite: raw.forceBlackAndWhite === true,
      priceBw,
      priceColor,
      pricePerPiece,
      totalPrice,
      localPath: '',
      status: 'queued',
    },
    index,
  )
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

  const orderNumber = await allocateOrderNumber(partnerId)
  const documents = [
    normalizeDocument(
      {
        id: 'doc-1',
        documentName,
        copies: 1,
        pages: 1,
        bwPages: 1,
        colorPages: 0,
        colorMode: 'bw',
        status: 'sending',
      },
      0,
    ),
  ]
  const aggregates = aggregateFromDocuments(documents)

  const ref = jobsRef(partnerId).doc()
  const references = jobReferenceFields({
    partnerId,
    printJobId: ref.id,
  })
  const job = {
    ...references,
    orderNumber,
    ...aggregates,
    documents,
    printerName,
    deviceName,
    status: 'sending',
    rawStatus: '',
    source: 'desktop',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  const batch = db.batch()
  batch.set(ref, job)
  writeStatusEvent(batch, {
    jobRef: ref,
    partnerId,
    printJobId: ref.id,
    status: 'sending',
    source: 'desktop',
  })
  await batch.commit()
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

  const partnerData = partnerSnap.data() || {}
  const isReservation = !isLocationOnline(partnerData.location)

  if (partnerData.services && partnerData.services.printing === false) {
    res.status(403).json({ error: 'Printing is not enabled for this partner' })
    return
  }

  const paperSizes = normalizePaperSizes(partnerData.paperSizes)
  const rawDocuments = Array.isArray(req.body.documents)
    ? req.body.documents
    : [
        {
          documentName: req.body.documentName,
          fileUrl: req.body.fileUrl,
          filePath: req.body.filePath,
          paperSizeId: req.body.paperSizeId,
          copies: req.body.copies,
          pages: req.body.pages,
          bwPages: req.body.bwPages,
          colorPages: req.body.colorPages,
          colorMode: req.body.colorMode,
        },
      ]

  if (rawDocuments.length === 0) {
    res.status(400).json({ error: 'Add at least one document to the order' })
    return
  }

  let documents
  try {
    documents = rawDocuments.map((item, index) => buildPricedDocument(item, paperSizes, index))
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid document in order' })
    return
  }

  const aggregates = aggregateFromDocuments(documents)
  const customerName = [req.profile?.firstName, req.profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
  const orderNumber = await allocateOrderNumber(partnerId)
  const convenienceFee = Math.max(
    0,
    Math.round((Number(partnerData.convenienceFee) || 0) * 100) / 100,
  )
  const totalPrice = Number((aggregates.totalPrice + convenienceFee).toFixed(2))
  const needsPayment = totalPrice >= 1

  const ref = jobsRef(partnerId).doc()
  const references = jobReferenceFields({
    partnerId,
    printJobId: ref.id,
    customerUid: req.user.uid,
  })
  const job = {
    ...references,
    orderNumber,
    ...aggregates,
    totalPrice,
    convenienceFee,
    documents,
    printerName: '',
    deviceName: '',
    status: needsPayment ? 'awaiting_payment' : 'queued',
    rawStatus: needsPayment
      ? isReservation
        ? 'Reserved — awaiting online payment'
        : 'Awaiting online payment'
      : isReservation
        ? 'Reserved — waiting for the shop to come online'
        : 'Waiting for partner desktop',
    source: 'mobile',
    isReservation,
    reservationStatus: isReservation ? 'pending' : '',
    customerUid: req.user.uid,
    customerEmail: req.profile?.email || req.user.email || '',
    customerName,
    paymentStatus: needsPayment ? 'unpaid' : 'paid',
    paymentIntentId: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  const batch = db.batch()
  batch.set(ref, job)
  writeStatusEvent(batch, {
    jobRef: ref,
    partnerId,
    printJobId: ref.id,
    customerUid: req.user.uid,
    status: job.status,
    rawStatus: job.rawStatus,
    source: 'mobile',
  })
  await batch.commit()
  const snap = await ref.get()
  res.status(201).json({
    printJob: mapJob(snap),
    requiresPayment: needsPayment,
    isReservation,
  })
}

async function cancelCustomerReservation(req, res) {
  const partnerId = String(req.params.partnerId || '').trim()
  const printJobId = String(req.params.id || '').trim()
  if (!partnerId || !printJobId) {
    res.status(400).json({ error: 'Partner id and print job id are required' })
    return
  }

  const ref = jobsRef(partnerId).doc(printJobId)
  const snap = await ref.get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Print reservation not found' })
    return
  }

  const existing = snap.data() || {}
  if (String(existing.customerUid || '') !== String(req.user.uid)) {
    res.status(403).json({ error: 'You cannot cancel this reservation' })
    return
  }
  if (existing.isReservation !== true) {
    res.status(400).json({ error: 'This print order is not a reservation' })
    return
  }
  if (existing.status === 'cancelled') {
    res.json({ printJob: mapJob(snap), alreadyCancelled: true })
    return
  }
  if (existing.status === 'printing' || existing.status === 'printed') {
    res.status(409).json({ error: 'This reservation is already being processed' })
    return
  }

  const rawStatus = 'Reservation cancelled by customer'
  const batch = db.batch()
  batch.update(ref, {
    status: 'cancelled',
    rawStatus,
    reservationStatus: 'cancelled',
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    refundStatus: existing.paymentStatus === 'paid' ? 'manual_review' : '',
  })
  writeStatusEvent(batch, {
    jobRef: ref,
    partnerId,
    printJobId,
    customerUid: existing.customerUid || '',
    paymentIntentId: existing.paymentIntentId || '',
    status: 'cancelled',
    rawStatus,
    source: 'customer',
  })
  await batch.commit()

  const updated = await ref.get()
  res.json({
    printJob: mapJob(updated),
    requiresRefundReview: existing.paymentStatus === 'paid',
  })
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

  const existing = snap.data() || {}
  const documents = documentsFromData(existing)
  const documentId = String(req.body.documentId || '').trim()

  const updates = {
    status,
    rawStatus: String(req.body.rawStatus || ''),
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (status === 'printing' && existing.status !== 'printing') {
    updates.printingStartedAt = FieldValue.serverTimestamp()
  }
  if (status === 'printed' && existing.status !== 'printed') {
    updates.completedAt = FieldValue.serverTimestamp()
  }

  if (req.body.printerName) {
    updates.printerName = String(req.body.printerName)
  }
  if (req.body.deviceName) {
    updates.deviceName = String(req.body.deviceName)
  }

  if (documentId && documents.length > 0) {
    const nextDocs = documents.map((doc) => {
      if (doc.id !== documentId) {
        return doc
      }
      return {
        ...doc,
        status,
        localPath:
          req.body.localPath !== undefined
            ? String(req.body.localPath || '').trim()
            : doc.localPath,
      }
    })
    updates.documents = nextDocs
    const aggregates = aggregateFromDocuments(nextDocs)
    updates.documentName = aggregates.documentName
    updates.documentCount = aggregates.documentCount
    updates.fileUrl = aggregates.fileUrl
    updates.filePath = aggregates.filePath
    updates.localPath = aggregates.localPath
    updates.totalPrice = Number(
      (
        aggregates.totalPrice + (Number(existing.convenienceFee) || 0)
      ).toFixed(2),
    )
  } else if (req.body.localPath !== undefined) {
    updates.localPath = String(req.body.localPath || '').trim()
    if (documents.length === 1) {
      updates.documents = [
        {
          ...documents[0],
          localPath: updates.localPath,
          status,
        },
      ]
    }
  }

  const batch = db.batch()
  batch.update(ref, updates)
  writeStatusEvent(batch, {
    jobRef: ref,
    partnerId,
    printJobId: ref.id,
    customerUid: existing.customerUid || '',
    paymentIntentId: existing.paymentIntentId || '',
    status,
    rawStatus: updates.rawStatus,
    source: 'partner',
  })
  await batch.commit()

  const updated = await ref.get()
  res.json({ printJob: mapJob(updated) })
}

module.exports = {
  listPrintJobs,
  createPrintJob,
  createCustomerPrintJob,
  cancelCustomerReservation,
  updatePrintJob,
}
