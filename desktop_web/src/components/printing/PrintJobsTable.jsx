import { Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'

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

export default function PrintJobsTable({ jobs }) {
  if (!jobs.length) {
    return null
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover', '& th': { fontWeight: 700, color: 'text.secondary', py: 0.75, fontSize: 13 } }}>
            <TableCell>Document</TableCell>
            <TableCell>Layout</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>When</TableCell>
            <TableCell align="right">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} hover sx={{ '& td': { py: 0.75, borderColor: 'divider' }, '&:last-of-type td': { borderBottom: 0 } }}>
              <TableCell>
                <Typography variant="body2" fontWeight={700} noWrap>
                  #{job.orderNumber || '—'} · {job.documentCount > 1
                    ? `${job.documentCount} docs`
                    : job.documentName || 'Print order'}
                </Typography>
                {job.customerName || job.customerEmail ? (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {job.customerName || job.customerEmail}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {job.paperSizeName
                    ? `${job.paperSizeName} · ×${job.copies || 1}`
                    : job.printerName || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatPrintMode(job)}
                  {Number(job.pages) > 1 ? ` · ${job.pages} pages` : ''}
                  {Number(job.totalPrice) > 0 ? ` · ₱${Number(job.totalPrice).toFixed(2)}` : ''}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {job.source === 'mobile' ? 'Mobile' : 'Desktop'}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="body2">{formatWhen(job.updatedAt || job.createdAt)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  color={STATUS_COLORS[job.status] || 'default'}
                  label={STATUS_LABELS[job.status] || job.status}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
