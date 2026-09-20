import { useMemo, useState } from 'react'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FilterListIcon from '@mui/icons-material/FilterList'
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined'
import HistoryIcon from '@mui/icons-material/History'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { brand } from '../../theme'
import { EmptyState, ErrorCard, StatusChip, cardGridSx, itemCardSx } from '../components'
import { useMyPrintJobs } from '../useMyPrintJobs'

const FILTERS = [
  { value: 'all', label: 'All orders' },
  { value: 'active', label: 'Active' },
  { value: 'awaitingPayment', label: 'Awaiting payment' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
]

function statusLabel(status) {
  switch (status) {
    case 'awaiting_payment':
      return 'Awaiting payment'
    case 'sending':
      return 'Sending'
    case 'queued':
      return 'Queued'
    case 'reprint_queued':
      return 'Reprint queued'
    case 'printing':
      return 'Printing'
    case 'printed':
      return 'Printed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status || 'Queued'
  }
}

function matchesFilter(job, filter) {
  switch (filter) {
    case 'active':
      return ['sending', 'queued', 'reprint_queued', 'printing'].includes(job.status)
    case 'awaitingPayment':
      return job.status === 'awaiting_payment'
    case 'reservations':
      return job.isReservation
    case 'completed':
      return job.status === 'printed'
    case 'cancelled':
      return job.status === 'cancelled'
    case 'failed':
      return job.status === 'failed'
    default:
      return true
  }
}

export default function HistoryPage() {
  const { jobs, loading, error } = useMyPrintJobs()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => jobs.filter((job) => matchesFilter(job, filter)), [jobs, filter])

  if (loading && jobs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3, width: '100%' }}>
      {error ? <ErrorCard message={`Could not load history.\n\n${error}`} /> : null}

      <TextField
        select
        fullWidth
        size="small"
        label="Filter history"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FilterListIcon />
            </InputAdornment>
          ),
        }}
      >
        {FILTERS.map((item) => (
          <MenuItem key={item.value} value={item.value}>
            {item.label}
          </MenuItem>
        ))}
      </TextField>

      <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700, mt: 1.5, mb: 1 }}>
        {filtered.length} order{filtered.length === 1 ? '' : 's'}
      </Typography>

      {jobs.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No print history yet"
          message="Your submitted print orders will appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FilterAltOffOutlinedIcon}
          title="No matching orders"
          message="Choose another history filter."
        />
      ) : (
        <Box sx={cardGridSx}>
          {filtered.map((job) => {
          const active = ['sending', 'queued', 'reprint_queued', 'printing'].includes(job.status)
          const date = job.createdAt
            ? `${job.createdAt.getMonth() + 1}/${job.createdAt.getDate()}/${job.createdAt.getFullYear()}`
            : ''
          const meta = [
            job.partnerName,
            `${job.documentCount} doc${job.documentCount === 1 ? '' : 's'}`,
            date,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <Box
              key={`${job.partnerId}-${job.id}`}
              component="button"
              type="button"
              onClick={() => setSelected(job)}
              sx={itemCardSx}
            >
              <Box
                sx={{
                  width: { xs: 42, md: 48 },
                  height: { xs: 42, md: 48 },
                  borderRadius: { xs: 1, md: 0.75 },
                  bgcolor: 'rgba(124, 92, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: brand.purple,
                  flexShrink: 0,
                }}
              >
                <ReceiptLongOutlinedIcon />
              </Box>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  width: { md: '100%' },
                  textAlign: { xs: 'left', md: 'center' },
                }}
              >
                <Typography noWrap sx={{ fontWeight: 900, color: brand.navy, fontSize: { md: 13 } }}>
                  Order #{job.orderNumber}
                </Typography>
                <Typography noWrap sx={{ color: brand.muted, fontSize: 12, mt: 0.35 }}>
                  {meta}
                </Typography>
              </Box>
              <Box
                sx={{
                  textAlign: { xs: 'right', md: 'center' },
                  width: { md: '100%' },
                  mt: { md: 0.5 },
                }}
              >
                <StatusChip
                  label={statusLabel(job.status)}
                  active={active || job.status === 'printed'}
                />
                <Typography
                  sx={{
                    color: brand.purpleDark,
                    fontSize: 12,
                    fontWeight: 800,
                    mt: 0.75,
                    display: { xs: 'block', md: 'block' },
                  }}
                >
                  ₱{job.totalPrice.toFixed(2)}
                </Typography>
              </Box>
              <ChevronRightIcon
                sx={{ color: brand.muted, fontSize: 20, display: { xs: 'block', md: 'none' } }}
              />
            </Box>
          )
        })}
        </Box>
      )}

      <JobDetailsDialog job={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}

function JobDetailsDialog({ job, onClose }) {
  if (!job) return null
  const date = job.createdAt?.toLocaleString?.() || ''

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ flex: 1, fontWeight: 800 }}>Order #{job.orderNumber}</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Row label="Shop" value={job.partnerName || '—'} />
        <Row label="Status" value={statusLabel(job.status)} />
        <Row label="Documents" value={String(job.documentCount)} />
        <Row label="Total" value={`₱${job.totalPrice.toFixed(2)}`} />
        {date ? <Row label="Created" value={date} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1 }}>
      <Typography sx={{ color: brand.muted }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, color: brand.navy, textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}
