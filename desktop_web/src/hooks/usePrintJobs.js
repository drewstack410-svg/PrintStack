import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

function toIso(value) {
  if (!value) {
    return null
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return null
}

function mapJob(docSnap) {
  const data = docSnap.data() || {}
  const documents = Array.isArray(data.documents) && data.documents.length > 0
    ? data.documents.map((item, index) => mapDocument(item, index))
    : data.documentName || data.fileUrl
      ? [
          mapDocument(
            {
              id: 'doc-1',
              documentName: data.documentName,
              fileUrl: data.fileUrl,
              filePath: data.filePath,
              paperSizeId: data.paperSizeId,
              paperSizeName: data.paperSizeName,
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
              status: data.status,
            },
            0,
          ),
        ]
      : []

  const pages =
    Number(data.pages) ||
    documents.reduce((sum, doc) => sum + (Number(doc.pages) || 0), 0) ||
    1
  let bwPages =
    Number(data.bwPages) ||
    documents.reduce((sum, doc) => sum + (Number(doc.bwPages) || 0), 0) ||
    0
  let colorPages =
    Number(data.colorPages) ||
    documents.reduce((sum, doc) => sum + (Number(doc.colorPages) || 0), 0) ||
    0
  if (bwPages + colorPages <= 0) {
    if (data.colorMode === 'color') {
      colorPages = pages
      bwPages = 0
    } else if (data.colorMode === 'mixed') {
      bwPages = 0
      colorPages = 0
    } else {
      bwPages = pages
      colorPages = 0
    }
  }

  const colorMode =
    data.colorMode === 'color' || data.colorMode === 'mixed'
      ? data.colorMode
      : colorPages > 0 && bwPages > 0
        ? 'mixed'
        : colorPages > 0
          ? 'color'
          : 'bw'

  return {
    id: docSnap.id,
    orderNumber: String(data.orderNumber || docSnap.id).padStart(8, '0').slice(-8),
    documentName: data.documentName || '',
    documentCount: Number(data.documentCount) || documents.length || 1,
    documents,
    printerName: data.printerName || '',
    deviceName: data.deviceName || '',
    status: data.status || 'queued',
    rawStatus: data.rawStatus || '',
    source: data.source || 'desktop',
    fileUrl: data.fileUrl || documents[0]?.fileUrl || '',
    filePath: data.filePath || documents[0]?.filePath || '',
    paperSizeId: data.paperSizeId || documents[0]?.paperSizeId || '',
    paperSizeName: data.paperSizeName || documents[0]?.paperSizeName || '',
    copies: Number(data.copies) || documents.reduce((s, d) => s + (Number(d.copies) || 0), 0) || 1,
    pages,
    bwPages,
    colorPages,
    colorMode,
    pricePerPiece: Number(data.pricePerPiece) || Number(documents[0]?.pricePerPiece) || 0,
    priceBw: Number(data.priceBw) || Number(documents[0]?.priceBw) || 0,
    priceColor: Number(data.priceColor) || Number(documents[0]?.priceColor) || 0,
    totalPrice:
      Number(data.totalPrice) ||
      documents.reduce((s, d) => s + (Number(d.totalPrice) || 0), 0) ||
      0,
    localPath: data.localPath || documents[0]?.localPath || '',
    customerUid: data.customerUid || '',
    customerEmail: data.customerEmail || '',
    customerName: data.customerName || '',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  }
}

function mapDocument(raw = {}, index = 0) {
  return {
    id: String(raw.id || `doc-${index + 1}`),
    documentName: raw.documentName || '',
    fileUrl: raw.fileUrl || '',
    filePath: raw.filePath || '',
    paperSizeId: raw.paperSizeId || '',
    paperSizeName: raw.paperSizeName || '',
    copies: Number(raw.copies) || 1,
    pages: Number(raw.pages) || 1,
    bwPages: Number(raw.bwPages) || 0,
    colorPages: Number(raw.colorPages) || 0,
    colorMode: raw.colorMode || 'bw',
    priceBw: Number(raw.priceBw) || 0,
    priceColor: Number(raw.priceColor) || 0,
    pricePerPiece: Number(raw.pricePerPiece) || 0,
    totalPrice: Number(raw.totalPrice) || 0,
    localPath: raw.localPath || '',
    status: raw.status || '',
  }
}

export function usePrintJobs({ partnerId, enabled = true }) {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !partnerId) {
      setJobs([])
      setError('')
      return undefined
    }

    let unsubscribe = () => {}
    let cancelled = false

    const attach = (jobsQuery, sortClientSide = false) =>
      onSnapshot(
        jobsQuery,
        (snapshot) => {
          if (cancelled) {
            return
          }
          let next = snapshot.docs.map(mapJob)
          if (sortClientSide) {
            next = next.sort((a, b) =>
              String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
            )
          }
          setJobs(next)
          setError('')
        },
        (err) => {
          if (cancelled) {
            return
          }
          console.warn('[print-jobs] realtime failed', err)
          if (!sortClientSide) {
            unsubscribe()
            unsubscribe = attach(
              query(collection(db, 'partners', partnerId, 'printJobs'), limit(40)),
              true,
            )
            return
          }
          setError(err.message || 'Could not listen for print jobs')
          setJobs([])
        },
      )

    unsubscribe = attach(
      query(
        collection(db, 'partners', partnerId, 'printJobs'),
        orderBy('createdAt', 'desc'),
        limit(40),
      ),
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [enabled, partnerId])

  return { jobs, setJobs, error }
}
