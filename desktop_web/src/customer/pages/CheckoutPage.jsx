import { useEffect, useMemo, useRef, useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import {
  Box,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  createCustomerPrintOrder,
  createPrintOrderPaymentIntent,
  finalizePrintOrderPayment,
  payPrintOrder,
} from '../../api'
import { useAuth } from '../../auth/AuthProvider'
import { brand } from '../../theme'
import { EmptyState, GradientButton, PartnerAvatar } from '../components'
import {
  draftLineTotal,
  draftPageBreakdown,
  draftToOrderPayload,
  uploadPrintFile,
} from '../printDraft'

function formatClaimLabel(value) {
  if (!value) return 'Choose when you will claim the printed files'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Choose when you will claim the printed files'
  const hour = d.getHours() % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, '0')
  const period = d.getHours() >= 12 ? 'PM' : 'AM'
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} · ${hour}:${minute} ${period}`
}

/**
 * Mobile-matching checkout: Papers to print → PayMongo → success.
 */
export default function CheckoutPage({ partner, documents: initialDocs, onClose, onAddMore }) {
  const { user } = useAuth()
  const [step, setStep] = useState('queue') // queue | pay | success
  const [documents, setDocuments] = useState(() => [...(initialDocs || [])])
  const [claimAt, setClaimAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [printJobId, setPrintJobId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [amountDisplay, setAmountDisplay] = useState('')

  const online = partner?.location?.online === true
  const shopName = partner?.companyName || 'Shop'
  const convenienceFee = Math.max(0, Number(partner?.convenienceFee) || 0)
  const documentsTotal = useMemo(
    () => documents.reduce((sum, doc) => sum + draftLineTotal(doc), 0),
    [documents],
  )
  const orderTotal = documentsTotal + convenienceFee

  useEffect(() => {
    setDocuments([...(initialDocs || [])])
  }, [initialDocs])

  function updateDoc(id, patch) {
    setDocuments((list) => list.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)))
  }

  function removeDoc(id) {
    setDocuments((list) => list.filter((doc) => doc.id !== id))
  }

  async function submitOrder() {
    if (!documents.length) {
      setError('Add at least one document to print.')
      return
    }
    if (!user || !partner?.id) {
      setError('You need to sign in first.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    try {
      const token = await user.getIdToken()
      const payloads = []
      for (const doc of documents) {
        const upload = await uploadPrintFile({
          partnerId: partner.id,
          userId: user.uid,
          file: doc.file,
          fileName: doc.fileName,
        })
        payloads.push(draftToOrderPayload(doc, upload))
      }

      const result = await createCustomerPrintOrder(token, partner.id, {
        documents: payloads,
        claimAt: claimAt ? new Date(claimAt).toISOString() : undefined,
      })

      const printJob =
        result?.printJob && typeof result.printJob === 'object' ? result.printJob : {}
      const nextJobId = String(printJob.id || '')
      const nextOrder = String(printJob.orderNumber || result?.orderNumber || '')
      const requiresPayment = result?.requiresPayment === true
      const isReservation = result?.isReservation === true
      const amount =
        printJob.totalPrice != null
          ? Number(printJob.totalPrice).toFixed(2)
          : orderTotal.toFixed(2)

      if (requiresPayment && nextJobId) {
        setPrintJobId(nextJobId)
        setOrderNumber(nextOrder)
        setAmountDisplay(amount)
        setStep('pay')
        return
      }

      const label = nextOrder
        ? `${isReservation ? 'Reservation' : 'Order'} #${nextOrder} submitted · ${documents.length} document${documents.length === 1 ? '' : 's'}.`
        : `${isReservation ? 'Reservation' : 'Order'} submitted · ${documents.length} document${documents.length === 1 ? '' : 's'}.`
      setSuccessMsg(label)
      setDocuments([])
      setOrderNumber(nextOrder)
      setAmountDisplay(amount)
      setStep('success')
    } catch (err) {
      console.warn('[checkout]', err)
      setError(err.message || 'Could not submit order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'pay') {
    return (
      <CheckoutPayment
        partner={partner}
        printJobId={printJobId}
        orderNumber={orderNumber}
        amountDisplay={amountDisplay}
        documents={documents}
        onBack={() => setStep('queue')}
        onSuccess={() => {
          setDocuments([])
          setStep('success')
        }}
      />
    )
  }

  if (step === 'success') {
    return (
      <CheckoutSuccess
        shopName={shopName}
        orderNumber={orderNumber}
        amountDisplay={amountDisplay || orderTotal.toFixed(2)}
        message={successMsg}
        onDone={onClose}
      />
    )
  }

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.mist,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          flexShrink: 0,
          bgcolor: brand.barDark,
          color: '#fff',
        }}
      >
        <IconButton onClick={onClose} aria-label="Back" sx={{ color: '#fff' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ flex: 1, fontWeight: 800 }}>Papers to print</Typography>
      </Box>

      {!online ? (
        <Typography
          sx={{
            mx: 2,
            mt: 1.5,
            px: 1.5,
            py: 1,
            bgcolor: 'rgba(124, 92, 255, 0.08)',
            borderRadius: 1,
            color: brand.navy,
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          This shop is offline. Submit now to reserve printing.
        </Typography>
      ) : null}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, pt: 2, pb: 1 }}>
        {documents.length === 0 ? (
          <EmptyState
            icon={PrintOutlinedIcon}
            title="Nothing to print yet"
            message="Add a document to build your print list."
          />
        ) : (
          <>
            <Typography sx={{ color: brand.muted, fontSize: 14, mb: 1.75, lineHeight: 1.35 }}>
              These papers will be printed at {shopName}. Add more if you need, then tap{' '}
              {online ? 'Pay & print' : 'Reserve'}.
            </Typography>

            <Box
              sx={{
                bgcolor: '#fff',
                borderRadius: 2,
                mb: 1.5,
                overflow: 'hidden',
              }}
            >
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  cursor: 'pointer',
                }}
              >
                <EventAvailableOutlinedIcon sx={{ color: brand.purple }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: brand.navy }}>
                    Claim date and time
                  </Typography>
                  <Typography sx={{ color: brand.muted, fontSize: 13 }}>
                    {formatClaimLabel(claimAt)}
                  </Typography>
                </Box>
                <input
                  type="datetime-local"
                  value={claimAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setClaimAt(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
              </Box>
            </Box>

            {documents.map((doc) => (
              <Box
                key={doc.id}
                sx={{
                  bgcolor: '#fff',
                  borderRadius: 2,
                  p: 1.5,
                  mb: 1.25,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800, color: brand.navy }}>
                      {doc.fileName}
                    </Typography>
                    <Typography sx={{ color: brand.muted, fontSize: 12.5, mt: 0.35 }}>
                      {[doc.paperSize?.name, draftPageBreakdown(doc), `${doc.copies} cop${doc.copies === 1 ? 'y' : 'ies'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: brand.purple }}>
                    ₱{draftLineTotal(doc).toFixed(2)}
                  </Typography>
                  <IconButton
                    size="small"
                    disabled={submitting}
                    onClick={() => removeDoc(doc.id)}
                    aria-label="Remove"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
                {(doc.colorPages || 0) > 0 ? (
                  <FormControlLabel
                    sx={{ m: 0, mt: 0.75, width: '100%', justifyContent: 'space-between' }}
                    labelPlacement="start"
                    control={
                      <Switch
                        checked={Boolean(doc.forceBlackAndWhite)}
                        disabled={submitting}
                        onChange={(e) =>
                          updateDoc(doc.id, { forceBlackAndWhite: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: brand.navy }}>
                        Print color as B&W
                      </Typography>
                    }
                  />
                ) : null}
              </Box>
            ))}
          </>
        )}

        {error ? (
          <Typography sx={{ mt: 1, color: '#B71C1C', fontWeight: 600, fontSize: 13 }}>
            {error}
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          bgcolor: '#fff',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.12)',
          px: 2,
          pt: 1.25,
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ color: brand.muted, fontWeight: 700, fontSize: 13 }}>
            Order · {documents.length} doc{documents.length === 1 ? '' : 's'}
          </Typography>
          <Typography sx={{ fontWeight: 900, color: brand.purple, fontSize: 15 }}>
            ₱{orderTotal.toFixed(2)}
          </Typography>
        </Box>
        {convenienceFee > 0 ? (
          <Typography sx={{ color: brand.muted, fontSize: 11.5, fontWeight: 600, mb: 1 }}>
            Incl. ₱{convenienceFee.toFixed(2)} convenience fee
          </Typography>
        ) : (
          <Box sx={{ mb: 1 }} />
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box
            component="button"
            type="button"
            disabled={submitting || !onAddMore}
            onClick={() => onAddMore?.(documents)}
            sx={{
              minWidth: 110,
              minHeight: 42,
              border: '1.5px solid rgba(124,92,255,0.28)',
              borderRadius: 999,
              bgcolor: '#fff',
              color: brand.navy,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: submitting || !onAddMore ? 'default' : 'pointer',
              opacity: onAddMore ? 1 : 0.5,
            }}
          >
            Add more
          </Box>
          <Box sx={{ flex: 1 }}>
            <GradientButton
              disabled={submitting || documents.length === 0}
              onClick={submitOrder}
            >
              {submitting ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : online ? (
                'Pay & print'
              ) : (
                'Reserve'
              )}
            </GradientButton>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function CheckoutPayment({
  partner,
  printJobId,
  orderNumber,
  amountDisplay,
  documents,
  onBack,
  onSuccess,
}) {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState('gcash')
  const [phone, setPhone] = useState('')
  const [paymentIntentId, setPaymentIntentId] = useState('')
  const [clientKey, setClientKey] = useState('')
  const [amount, setAmount] = useState(amountDisplay)
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const pollRef = useRef(null)

  const shopName = partner?.companyName || 'Shop'
  const amountLabel = amount?.startsWith?.('₱') ? amount : `₱${amount || '—'}`

  useEffect(() => {
    let cancelled = false
    async function loadIntent() {
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await createPrintOrderPaymentIntent(token, {
          partnerId: partner.id,
          printJobId,
        })
        if (cancelled) return
        setPaymentIntentId(String(data.paymentIntentId || ''))
        setClientKey(String(data.clientKey || ''))
        const display = String(data.amountDisplay || '').trim()
        if (display) setAmount(display)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not start payment.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (user && partner?.id && printJobId) loadIntent()
    return () => {
      cancelled = true
    }
  }, [user, partner?.id, printJobId])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function startPolling(intentId) {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const token = await user.getIdToken()
        await finalizePrintOrderPayment(token, intentId)
        if (pollRef.current) window.clearInterval(pollRef.current)
        setCheckoutUrl('')
        setPaying(false)
        onSuccess()
      } catch {
        // keep polling until paid or user cancels
      }
    }, 2500)
  }

  async function handlePay() {
    if (!paymentIntentId || !clientKey) {
      setError('Payment is not ready yet.')
      return
    }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Enter a valid mobile number.')
      return
    }
    const email = (user?.email || profile?.email || '').trim()
    if (!email) {
      setError('Your account needs an email for receipts.')
      return
    }

    setPaying(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const data = await payPrintOrder(token, {
        paymentIntentId,
        clientKey,
        paymentMethodType: method,
        billing: {
          name: (user?.displayName || profile?.firstName || 'Customer').trim() || 'Customer',
          email,
          phone: digits,
        },
        returnPath: '/payment/confirmation',
      })
      const redirect = String(data.redirectUrl || '').trim()
      if (redirect) {
        setCheckoutUrl(redirect)
        startPolling(paymentIntentId)
        return
      }
      onSuccess()
    } catch (err) {
      setError(err.message || 'Payment failed.')
      setPaying(false)
    }
  }

  if (checkoutUrl) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            py: 1,
            bgcolor: brand.barDark,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ flex: 1, fontWeight: 800, pl: 1 }}>PayMongo</Typography>
          <IconButton
            sx={{ color: '#fff' }}
            aria-label="Close checkout"
            onClick={() => {
              if (pollRef.current) window.clearInterval(pollRef.current)
              setCheckoutUrl('')
              setPaying(false)
              setError('Payment was not completed. Your order is held until you pay.')
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          component="iframe"
          title="PayMongo checkout"
          src={checkoutUrl}
          sx={{ flex: 1, border: 0, width: '100%', minHeight: 0 }}
        />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.mist,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          bgcolor: brand.barDark,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <IconButton onClick={onBack} aria-label="Back" sx={{ color: '#fff' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ flex: 1, fontWeight: 800 }}>Checkout</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pt: 2, pb: 2 }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 1.75, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
            <PartnerAvatar url={partner?.logoUrl} name={shopName} size={34} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontWeight: 800, color: brand.navy }}>
                {shopName}
              </Typography>
              {orderNumber ? (
                <Typography sx={{ color: brand.muted, fontSize: 13 }}>Order #{orderNumber}</Typography>
              ) : null}
            </Box>
            <Typography sx={{ fontWeight: 900, color: brand.purple, fontSize: 15 }}>
              {amountLabel}
            </Typography>
          </Box>
          {documents.map((doc) => (
            <Typography
              key={doc.id}
              noWrap
              sx={{ color: brand.muted, fontSize: 12.5, py: 0.35 }}
            >
              {doc.fileName} · ₱{draftLineTotal(doc).toFixed(2)}
            </Typography>
          ))}
        </Box>

        <Typography sx={{ fontWeight: 800, color: brand.navy, mb: 1 }}>Payment method</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {[
            { id: 'gcash', label: 'GCash' },
            { id: 'paymaya', label: 'Maya' },
          ].map((item) => {
            const selected = method === item.id
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                onClick={() => setMethod(item.id)}
                sx={{
                  flex: 1,
                  minHeight: 48,
                  border: selected
                    ? '1.5px solid rgba(124,92,255,0.65)'
                    : '1.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  bgcolor: selected ? 'rgba(124,92,255,0.1)' : '#fff',
                  color: brand.navy,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </Box>
            )
          })}
        </Box>

        <TextField
          fullWidth
          label="Mobile number"
          placeholder="09XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
          inputProps={{ inputMode: 'numeric' }}
          sx={{ bgcolor: '#fff', mb: 2 }}
        />

        {error ? (
          <Typography sx={{ color: '#B71C1C', fontWeight: 600, fontSize: 13, mb: 1.5 }}>
            {error}
          </Typography>
        ) : null}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <GradientButton
            disabled={paying || !paymentIntentId}
            onClick={handlePay}
          >
            {paying ? (
              <CircularProgress size={18} sx={{ color: '#fff' }} />
            ) : (
              `Pay ${amountLabel}`
            )}
          </GradientButton>
        )}
      </Box>
    </Box>
  )
}

function CheckoutSuccess({ shopName, orderNumber, amountDisplay, message, onDone }) {
  const amountLabel = String(amountDisplay || '').startsWith('₱')
    ? amountDisplay
    : `₱${amountDisplay || '—'}`

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.mist,
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 56, color: '#22C55E', mb: 1.5 }} />
        <Typography sx={{ fontSize: 18, fontWeight: 900, color: brand.navy }}>
          Payment successful
        </Typography>
        <Typography sx={{ color: brand.muted, mt: 1, maxWidth: 320 }}>
          {message ||
            `Your print job${orderNumber ? ` #${orderNumber}` : ''} at ${shopName} is queued.`}
        </Typography>
        <Typography sx={{ fontWeight: 900, color: brand.purple, fontSize: 15, mt: 2.5 }}>
          {amountLabel}
        </Typography>
      </Box>
      <GradientButton onClick={onDone}>Done</GradientButton>
    </Box>
  )
}
