import { useEffect, useMemo, useRef, useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ReplayIcon from '@mui/icons-material/Replay'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { getDesktopApi } from '../api'
import PageHeader from '../components/dashboard/PageHeader'
import { orderDocuments } from '../lib/printOrder'

const STATUS_LABELS = {
  awaiting_payment: 'Awaiting payment',
  sending: 'Sending',
  queued: 'Queued',
  reprint_queued: 'Reprint queued',
  printing: 'Printing',
  printed: 'Printed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS = {
  awaiting_payment: 'default',
  sending: 'warning',
  queued: 'warning',
  reprint_queued: 'warning',
  printing: 'info',
  printed: 'success',
  failed: 'error',
  cancelled: 'default',
}

const PDF_PAGE_WIDTH = 794
const PDF_PAGE_HEIGHT = 1123

function formatPrintMode(item) {
  const bw = Number(item.bwPages) || 0
  const color = Number(item.colorPages) || 0
  if (bw > 0 && color > 0) {
    return `${bw} B&W · ${color} color`
  }
  if (item.colorMode === 'mixed') {
    return 'Mixed'
  }
  if (color > 0 || item.colorMode === 'color') {
    return 'Color'
  }
  return 'B&W'
}

function previewSrc(fileUrl) {
  const base = String(fileUrl || '').split('#')[0]
  return `${base}#toolbar=0&navpanes=0&scrollbar=0`
}

async function openLocalPdf({ job, doc }) {
  const fileUrl = doc?.fileUrl || ''
  const localPath = doc?.localPath || ''
  if (!fileUrl && !localPath) {
    return
  }

  const desktop = getDesktopApi()
  if (desktop?.files?.openJobPdf) {
    await desktop.files.openJobPdf({
      jobId: job.id,
      fileUrl,
      documentName: doc?.documentName || 'document.pdf',
      localPath,
      customerName: job.customerName || '',
      customerEmail: job.customerEmail || '',
      createdAt: job.createdAt || '',
    })
    return
  }

  if (fileUrl) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer')
  }
}

function DocPreview({ doc }) {
  const wrapRef = useRef(null)
  const [wrapWidth, setWrapWidth] = useState(0)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width || 0
      setWrapWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!doc?.fileUrl) {
    return (
      <Stack
        ref={wrapRef}
        alignItems="center"
        justifyContent="center"
        spacing={0.5}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#eef2f7',
          color: 'text.secondary',
        }}
      >
        <DescriptionOutlinedIcon sx={{ fontSize: 28, opacity: 0.55 }} />
        <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11 }}>
          No PDF preview
        </Typography>
      </Stack>
    )
  }

  const pageCount = Math.min(40, Math.max(12, Number(doc.pages) || 12))
  const scale = wrapWidth > 0 ? wrapWidth / PDF_PAGE_WIDTH : 1
  const contentHeight = PDF_PAGE_HEIGHT * pageCount * scale
  const frameWidth = PDF_PAGE_WIDTH + 24

  return (
    <Box
      ref={wrapRef}
      sx={{
        width: '100%',
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        bgcolor: '#d7dde5',
        overscrollBehavior: 'contain',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(15, 23, 42, 0.28)',
          borderRadius: 8,
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: contentHeight,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          component="iframe"
          title={`Preview ${doc.documentName || doc.id}`}
          src={previewSrc(doc.fileUrl)}
          tabIndex={-1}
          sx={{
            border: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            width: frameWidth,
            height: PDF_PAGE_HEIGHT * pageCount,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Box>
  )
}

function DocumentCard({
  job,
  doc,
  isSelected,
  onToggleSelect,
  onReprint,
  reprinting,
  reprintDisabled,
}) {
  const canOpen = Boolean(doc.fileUrl || doc.localPath)
  const canReprint = Boolean(doc.fileUrl)

  return (
    <Paper
      elevation={0}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={() => {
        if (canOpen) {
          openLocalPdf({ job, doc }).catch((error) => {
            console.warn('[print-jobs] open local pdf failed', error)
          })
        }
      }}
      onKeyDown={(event) => {
        if (!canOpen) {
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openLocalPdf({ job, doc }).catch((error) => {
            console.warn('[print-jobs] open local pdf failed', error)
          })
        }
      }}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'stretch',
        minWidth: 0,
        maxWidth: '100%',
        cursor: canOpen ? 'pointer' : 'default',
        bgcolor: isSelected ? 'rgba(79, 124, 255, 0.06)' : 'background.paper',
        transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
        '&:hover': canOpen
          ? {
              borderColor: isSelected ? 'primary.main' : 'primary.light',
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)',
            }
          : undefined,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flex: { xs: '0 0 auto', sm: '0 0 148px' },
          width: { xs: '100%', sm: 148 },
          height: { xs: 160, sm: 'auto' },
          minHeight: { sm: 0 },
          alignSelf: 'stretch',
          borderRight: { sm: '1px solid' },
          borderBottom: { xs: '1px solid', sm: 0 },
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: '#d7dde5',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: { xs: 'relative', sm: 'absolute' },
            inset: { sm: 0 },
            width: '100%',
            height: { xs: 160, sm: '100%' },
          }}
        >
          <DocPreview doc={doc} />
        </Box>
      </Box>
      <Stack spacing={1} justifyContent="space-between" sx={{ p: { xs: 1, sm: 1.25 }, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <Checkbox
              size="small"
              checked={isSelected}
              disabled={!canReprint}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelect?.(doc.id)}
              inputProps={{ 'aria-label': `Select ${doc.documentName || 'document'}` }}
              sx={{ p: 0.25, mt: 0.1 }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}
              >
                Document
              </Typography>
              <Typography
                variant="body2"
                fontWeight={800}
                title={doc.documentName || 'Document'}
                sx={{
                  mt: 0.15,
                  fontSize: { xs: 13, sm: 13.5 },
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {doc.documentName || 'Document'}
              </Typography>
            </Box>
          </Stack>
          {doc.status ? (
            <Chip
              size="small"
              color={STATUS_COLORS[doc.status] || 'default'}
              label={STATUS_LABELS[doc.status] || doc.status}
              sx={{ height: 22, flexShrink: 0, fontWeight: 700, '& .MuiChip-label': { px: 0.9, fontSize: 11 } }}
            />
          ) : null}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.75,
            pt: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.35, textTransform: 'uppercase' }}
            >
              Paper
            </Typography>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: 12.5 }}>
              {doc.paperSizeName || '—'}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.35, textTransform: 'uppercase' }}
            >
              Copies
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: 12.5 }}>
              ×{doc.copies || 1}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.35, textTransform: 'uppercase' }}
            >
              Print
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={formatPrintMode(doc)}
                variant="outlined"
                sx={{ height: 20, fontWeight: 700, '& .MuiChip-label': { px: 0.7, fontSize: 11 } }}
              />
              {Number(doc.pages) > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {doc.pages}p
                </Typography>
              ) : null}
            </Stack>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.35, textTransform: 'uppercase' }}
            >
              Price
            </Typography>
            <Typography variant="body2" fontWeight={800} sx={{ fontSize: 13, color: 'primary.dark' }}>
              {Number(doc.totalPrice) > 0 ? `₱${Number(doc.totalPrice).toFixed(2)}` : '—'}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {canOpen ? 'Click to open PDF' : 'No file available'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
            disabled={!canReprint || reprintDisabled || reprinting}
            onClick={(event) => {
              event.stopPropagation()
              onReprint?.(doc)
            }}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {reprinting ? 'Printing…' : 'Reprint'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

export default function OrderDocumentsPage({
  job,
  onBack,
  onReprintDocument,
  reprintingDocId = '',
  reprintDisabled = false,
  printersReady = false,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkReprinting, setBulkReprinting] = useState(false)

  const documents = useMemo(() => orderDocuments(job), [job])
  const selectableDocs = useMemo(
    () => documents.filter((doc) => Boolean(doc.fileUrl)),
    [documents],
  )
  const selectedDocs = useMemo(
    () => selectableDocs.filter((doc) => selectedIds.has(doc.id)),
    [selectableDocs, selectedIds],
  )
  const allSelected =
    selectableDocs.length > 0 && selectableDocs.every((doc) => selectedIds.has(doc.id))

  useEffect(() => {
    setSelectedIds((current) => {
      const valid = new Set(selectableDocs.map((doc) => doc.id))
      const next = new Set([...current].filter((id) => valid.has(id)))
      return next.size === current.size ? current : next
    })
  }, [selectableDocs])

  function toggleSelect(docId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        return new Set()
      }
      return new Set(selectableDocs.map((doc) => doc.id))
    })
  }

  async function handleBulkReprint() {
    if (!selectedDocs.length || !onReprintDocument) {
      return
    }
    setBulkReprinting(true)
    try {
      for (const doc of selectedDocs) {
        await onReprintDocument(doc)
      }
      setSelectedIds(new Set())
    } catch {
      // Parent surfaces the error alert.
    } finally {
      setBulkReprinting(false)
    }
  }

  if (!job) {
    return null
  }

  const customer = job.customerName || job.customerEmail || ''

  return (
    <Stack spacing={{ xs: 1.25, sm: 1.5 }} sx={{ width: '100%', minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <IconButton size="small" onClick={onBack} aria-label="Back to orders" sx={{ mt: 0.35 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <PageHeader
            title={`Order #${job.orderNumber || '—'}`}
            subtitle={
              customer
                ? `${documents.length} document${documents.length === 1 ? '' : 's'} · ${customer}`
                : `${documents.length} document${documents.length === 1 ? '' : 's'} in this order`
            }
          />
        </Box>
        <Chip
          size="small"
          color={STATUS_COLORS[job.status] || 'default'}
          label={STATUS_LABELS[job.status] || job.status}
          sx={{ mt: 0.5, height: 24, flexShrink: 0, fontWeight: 700 }}
        />
      </Stack>

      {documents.length > 0 ? (
        <Paper
          elevation={0}
          sx={{
            px: 1.25,
            py: 0.75,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <FormControlLabel
            sx={{ mr: 1, ml: 0 }}
            control={
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selectedDocs.length > 0 && !allSelected}
                onChange={toggleSelectAll}
                disabled={selectableDocs.length === 0 || bulkReprinting}
              />
            }
            label={
              <Typography variant="body2" fontWeight={600}>
                Select all
              </Typography>
            }
          />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
            {selectedDocs.length > 0
              ? `${selectedDocs.length} selected`
              : `${selectableDocs.length} reprintable`}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<ReplayIcon />}
            onClick={handleBulkReprint}
            disabled={
              selectedDocs.length === 0 ||
              !printersReady ||
              reprintDisabled ||
              bulkReprinting ||
              Boolean(reprintingDocId)
            }
          >
            {bulkReprinting
              ? 'Reprinting…'
              : `Reprint selected${selectedDocs.length ? ` (${selectedDocs.length})` : ''}`}
          </Button>
          {selectedDocs.length > 0 ? (
            <Button
              size="small"
              variant="text"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkReprinting}
            >
              Clear
            </Button>
          ) : null}
        </Paper>
      ) : null}

      {documents.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 4,
            px: 2,
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Typography fontWeight={700}>No documents</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            This order has no printable documents yet.
          </Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1, sm: 1.25 },
            width: '100%',
            minWidth: 0,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
            },
          }}
        >
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              job={job}
              doc={doc}
              isSelected={selectedIds.has(doc.id)}
              onToggleSelect={toggleSelect}
              onReprint={onReprintDocument}
              reprinting={reprintingDocId === doc.id}
              reprintDisabled={reprintDisabled || bulkReprinting || !printersReady}
            />
          ))}
        </Box>
      )}
    </Stack>
  )
}
