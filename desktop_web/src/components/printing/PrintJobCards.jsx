import { useEffect, useRef, useState } from 'react'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ReplayIcon from '@mui/icons-material/Replay'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { getDesktopApi } from '../../api'

const STATUS_LABELS = {
  sending: 'Sending',
  queued: 'Queued',
  printing: 'Printing',
  printed: 'Printed',
  failed: 'Failed',
}

const STATUS_COLORS = {
  sending: 'warning',
  queued: 'warning',
  printing: 'info',
  printed: 'success',
  failed: 'error',
}

/** Approximate PDF page size at 96dpi (A4-ish). Used to fit width in the card. */
const PDF_PAGE_WIDTH = 794
const PDF_PAGE_HEIGHT = 1123

function formatWhen(iso) {
  if (!iso) {
    return '—'
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatPrintMode(job) {
  const bw = Number(job.bwPages) || 0
  const color = Number(job.colorPages) || 0
  if (bw > 0 && color > 0) {
    return `${bw} B&W · ${color} color`
  }
  if (job.colorMode === 'mixed') {
    return 'Mixed'
  }
  if (color > 0 || job.colorMode === 'color') {
    return 'Color'
  }
  return 'B&W'
}

function previewSrc(fileUrl) {
  const base = String(fileUrl || '').split('#')[0]
  return `${base}#toolbar=0&navpanes=0&scrollbar=0`
}

async function openLocalPdf(job) {
  if (!job?.fileUrl && !job?.localPath) {
    return
  }

  const desktop = getDesktopApi()
  if (desktop?.files?.openJobPdf) {
    await desktop.files.openJobPdf({
      jobId: job.id,
      fileUrl: job.fileUrl || '',
      documentName: job.documentName || 'document.pdf',
      localPath: job.localPath || '',
      customerName: job.customerName || '',
      customerEmail: job.customerEmail || '',
      createdAt: job.createdAt || '',
    })
    return
  }

  if (job.fileUrl) {
    window.open(job.fileUrl, '_blank', 'noopener,noreferrer')
  }
}

function JobPreview({ job }) {
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

  if (!job.fileUrl) {
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

  const pageCount = Math.min(40, Math.max(12, Number(job.pages) || 12))
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
          title={`Preview ${job.documentName || job.id}`}
          src={previewSrc(job.fileUrl)}
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

export default function PrintJobCards({
  jobs = [],
  emptyMessage = 'Mobile and desktop jobs will show up here with a preview.',
  selectedIds = new Set(),
  onToggleSelect,
  onReprint,
  reprintingId = '',
  reprintDisabled = false,
}) {
  if (!jobs.length) {
    return (
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
        <Typography fontWeight={700}>No print jobs</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {emptyMessage}
        </Typography>
      </Paper>
    )
  }

  return (
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
      {jobs.map((job) => {
        const canOpen = Boolean(job.fileUrl || job.localPath)
        const canReprint = Boolean(job.fileUrl)
        const isSelected = selectedIds.has(job.id)
        const isReprinting = reprintingId === job.id

        return (
          <Paper
            key={job.id}
            elevation={0}
            role={canOpen ? 'button' : undefined}
            tabIndex={canOpen ? 0 : undefined}
            onClick={() => {
              if (canOpen) {
                openLocalPdf(job).catch((error) => {
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
                openLocalPdf(job).catch((error) => {
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
                <JobPreview job={job} />
              </Box>
            </Box>
            <Stack
              spacing={1}
              justifyContent="space-between"
              sx={{ p: { xs: 1, sm: 1.25 }, flex: 1, minWidth: 0 }}
            >
              <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
                <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleSelect?.(job.id)}
                    inputProps={{ 'aria-label': `Select ${job.documentName || 'print job'}` }}
                    sx={{ p: 0.25, mt: 0.1 }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}
                    >
                      Order #{job.orderNumber || '—'}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      title={job.documentName || 'Print order'}
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
                      {job.documentCount > 1
                        ? `${job.documentCount} documents`
                        : job.documentName || 'Print order'}
                    </Typography>
                    {job.documentCount > 1 && job.documentName ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        title={job.documentName}
                        sx={{ mt: 0.2, fontSize: 11 }}
                      >
                        {job.documentName}
                      </Typography>
                    ) : null}
                    {job.customerName || job.customerEmail ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        title={job.customerName || job.customerEmail}
                        sx={{ mt: 0.35, fontSize: 11.5 }}
                      >
                        {job.customerName || job.customerEmail}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
                <Chip
                  size="small"
                  color={STATUS_COLORS[job.status] || 'default'}
                  label={STATUS_LABELS[job.status] || job.status}
                  sx={{ height: 22, flexShrink: 0, fontWeight: 700, '& .MuiChip-label': { px: 0.9, fontSize: 11 } }}
                />
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
                    {job.paperSizeName || '—'}
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
                    ×{job.copies || 1}
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
                      label={formatPrintMode(job)}
                      variant="outlined"
                      sx={{ height: 20, fontWeight: 700, '& .MuiChip-label': { px: 0.7, fontSize: 11 } }}
                    />
                    {Number(job.pages) > 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        {job.pages}p
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
                    {Number(job.totalPrice) > 0 ? `₱${Number(job.totalPrice).toFixed(2)}` : '—'}
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, minWidth: 0 }} noWrap>
                  {formatWhen(job.updatedAt || job.createdAt)}
                  {job.printerName ? ` · ${job.printerName}` : ''}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
                  disabled={!canReprint || reprintDisabled || isReprinting}
                  onClick={(event) => {
                    event.stopPropagation()
                    onReprint?.(job)
                  }}
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12 }}
                >
                  {isReprinting ? 'Printing…' : 'Reprint'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )
      })}
    </Box>
  )
}
