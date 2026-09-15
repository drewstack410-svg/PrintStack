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
import { orderDocuments } from '../../lib/printOrder'

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

function OrderCard({
  job,
  isSelected,
  onToggleSelect,
  onOpen,
  onReprint,
  reprintingId,
  reprintDisabled,
}) {
  const docs = orderDocuments(job)
  const canReprint = docs.some((doc) => doc.fileUrl) || Boolean(job.fileUrl)
  const isReprinting = reprintingId === job.id
  const docCount = docs.length || job.documentCount || 1

  return (
    <Paper
      elevation={0}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        minWidth: 0,
        maxWidth: '100%',
        cursor: 'pointer',
        bgcolor: isSelected ? 'rgba(79, 124, 255, 0.06)' : 'background.paper',
        transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
        '&:hover': {
          borderColor: isSelected ? 'primary.main' : 'primary.light',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.08)',
        },
      }}
    >
      <Stack spacing={1} sx={{ p: { xs: 1.1, sm: 1.35 } }}>
        <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <Checkbox
              size="small"
              checked={isSelected}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelect?.(job.id)}
              inputProps={{ 'aria-label': `Select order ${job.orderNumber || job.id}` }}
              sx={{ p: 0.25, mt: 0.1 }}
            />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: 'text.secondary',
              }}
            >
              <DescriptionOutlinedIcon fontSize="small" />
            </Box>
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
                sx={{
                  mt: 0.15,
                  fontSize: { xs: 13, sm: 14 },
                  lineHeight: 1.3,
                }}
              >
                {docCount} document{docCount === 1 ? '' : 's'}
              </Typography>
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
            {' · Open documents'}
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
}

export default function PrintJobCards({
  jobs = [],
  emptyMessage = 'Mobile and desktop orders will show up here.',
  selectedIds = new Set(),
  onToggleSelect,
  onOpenOrder,
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
          sm: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
        },
      }}
    >
      {jobs.map((job) => (
        <OrderCard
          key={job.id}
          job={job}
          isSelected={selectedIds.has(job.id)}
          onToggleSelect={onToggleSelect}
          onOpen={() => onOpenOrder?.(job)}
          onReprint={onReprint}
          reprintingId={reprintingId}
          reprintDisabled={reprintDisabled}
        />
      ))}
    </Box>
  )
}
