import { Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'

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
                  {job.documentName || 'Print job'}
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
                  {job.colorMode === 'color' ? 'Color' : 'B&W'}
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
