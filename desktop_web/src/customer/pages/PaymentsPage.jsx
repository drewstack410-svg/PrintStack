import { useEffect, useMemo, useState } from 'react'
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined'
import FilterListIcon from '@mui/icons-material/FilterList'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import {
  Box,
  CircularProgress,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { listMyPrintOrderPayments } from '../../api'
import { useAuth } from '../../auth/AuthProvider'
import { brand } from '../../theme'
import { EmptyState, ErrorCard, StatusChip, cardGridSx, itemCardSx } from '../components'

export default function PaymentsPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const payload = await listMyPrintOrderPayments(token)
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.payments)
            ? payload.payments
            : []
        if (!cancelled) setPayments(list)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load payments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (user) load()
    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => {
    return payments.filter((payment) => {
      const status = String(payment.paymentStatus || 'pending').toLowerCase()
      if (filter === 'paid') return status === 'paid'
      if (filter === 'failed') return status === 'failed'
      if (filter === 'pending') return status !== 'paid' && status !== 'failed'
      return true
    })
  }, [payments, filter])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 3, width: '100%' }}>
      {error ? <ErrorCard message={`Could not load payments.\n\n${error}`} /> : null}

      <TextField
        select
        fullWidth
        size="small"
        label="Payment status"
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
        <MenuItem value="all">All payments</MenuItem>
        <MenuItem value="paid">Paid</MenuItem>
        <MenuItem value="pending">Pending</MenuItem>
        <MenuItem value="failed">Failed</MenuItem>
      </TextField>

      <Typography sx={{ color: brand.muted, fontSize: 12, fontWeight: 700, mt: 1.5, mb: 1 }}>
        {filtered.length} payment{filtered.length === 1 ? '' : 's'}
      </Typography>

      {payments.length === 0 ? (
        <EmptyState
          icon={PaymentsOutlinedIcon}
          title="No payments yet"
          message="Payments for your print orders will appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FilterAltOffOutlinedIcon}
          title="No matching payments"
          message="Choose another payment status."
        />
      ) : (
        <Box sx={cardGridSx}>
          {filtered.map((payment, index) => {
          const status = String(payment.paymentStatus || 'pending').toLowerCase()
          const orderNumber = String(payment.orderNumber || '')
          const partnerName = String(payment.partnerName || '')
          const method = String(payment.paymentMethodType || '')
          const amount = Number(payment.amount) || 0
          const createdAt = Date.parse(String(payment.createdAt || ''))
          const date = Number.isNaN(createdAt)
            ? ''
            : (() => {
                const d = new Date(createdAt)
                return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
              })()

          return (
            <Box
              key={payment.id || `${orderNumber}-${index}`}
              sx={{ ...itemCardSx, cursor: 'default' }}
            >
              <Box
                sx={{
                  width: { xs: 44, md: 48 },
                  height: { xs: 44, md: 48 },
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
                <Typography noWrap sx={{ fontWeight: 800, color: brand.navy, fontSize: { md: 13 } }}>
                  {orderNumber ? `Order #${orderNumber}` : 'Print order'}
                </Typography>
                {partnerName ? (
                  <Typography noWrap sx={{ color: brand.muted, fontSize: 13, mt: 0.5 }}>
                    {partnerName}
                  </Typography>
                ) : null}
                {method || date ? (
                  <Typography noWrap sx={{ color: brand.muted, fontSize: 12, mt: 0.5 }}>
                    {[method ? method.toUpperCase() : '', date].filter(Boolean).join(' · ')}
                  </Typography>
                ) : null}
              </Box>
              <Box
                sx={{
                  textAlign: { xs: 'right', md: 'center' },
                  width: { md: '100%' },
                  mt: { md: 0.5 },
                }}
              >
                <StatusChip
                  label={status === 'paid' ? 'Paid' : status === 'failed' ? 'Failed' : 'Pending'}
                  active={status === 'paid'}
                />
                <Typography sx={{ fontWeight: 800, color: brand.purpleDark, mt: 1, fontSize: 12 }}>
                  ₱{amount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          )
        })}
        </Box>
      )}
    </Box>
  )
}
