import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReplayIcon from '@mui/icons-material/Replay'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  createPrintJob,
  getDesktopApi,
  updatePrintJob,
} from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import PrintJobCards from '../components/printing/PrintJobCards'
import PrintJobsSkeleton from '../components/printing/PrintJobsSkeleton'
import { usePrintJobs } from '../hooks/usePrintJobs'
import { orderDocuments } from '../lib/printOrder'
import OrderDocumentsPage from './OrderDocumentsPage'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'queued', label: 'Queued' },
  { value: 'reprint_queued', label: 'Reprint queued' },
  { value: 'sending', label: 'Sending' },
  { value: 'printing', label: 'Printing' },
  { value: 'printed', label: 'Printed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'desktop', label: 'Desktop' },
]

export default function PrintingPage() {
  const { user, profile } = useAuth()
  const printersApi = getDesktopApi()?.printers
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(Boolean(printersApi))
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedJobIds, setSelectedJobIds] = useState(() => new Set())
  const [reprintingId, setReprintingId] = useState('')
  const [reprintingDocId, setReprintingDocId] = useState('')
  const [bulkReprinting, setBulkReprinting] = useState(false)
  const [openOrderId, setOpenOrderId] = useState('')
  const [printDoneDialog, setPrintDoneDialog] = useState(null)
  const [continueWithKey, setContinueWithKey] = useState(true)
  const [continueKey, setContinueKey] = useState({ code: 'Space', label: 'Space' })
  const {
    jobs: printJobs,
    setJobs: setPrintJobs,
    loading: jobsLoading,
    error: jobsError,
  } = usePrintJobs({
    partnerId: profile?.partnerId,
    enabled: Boolean(profile?.partnerId),
  })
  const autoPrinted = useRef(new Set())
  const processingRef = useRef(false)
  const selectedRef = useRef(selected)
  const printersRef = useRef(printers)
  const printDoneResolverRef = useRef(null)
  const continueWithKeyRef = useRef(true)
  const continueKeyCodeRef = useRef('Space')
  const settingsApi = getDesktopApi()?.settings

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    printersRef.current = printers
  }, [printers])

  useEffect(() => {
    continueWithKeyRef.current = continueWithKey
  }, [continueWithKey])

  useEffect(() => {
    continueKeyCodeRef.current = continueKey.code || 'Space'
  }, [continueKey])

  useEffect(() => {
    if (!settingsApi?.getPreferences) {
      return undefined
    }

    let cancelled = false
    settingsApi
      .getPreferences()
      .then((prefs) => {
        if (cancelled) {
          return
        }
        setContinueWithKey(prefs?.continuePrintWithKey !== false)
        setContinueKey({
          code: prefs?.continuePrintKeyCode || 'Space',
          label: prefs?.continuePrintKeyLabel || 'Space',
        })
      })
      .catch(() => {
        // Keep defaults.
      })

    return () => {
      cancelled = true
    }
  }, [settingsApi])

  const loadPrinters = useCallback(async () => {
    if (!printersApi) {
      setLoadingPrinters(false)
      return
    }

    setLoadingPrinters(true)
    setError('')
    setSuccess('')
    try {
      const list = await printersApi.list()
      const next = Array.isArray(list) ? list : []
      setPrinters(next)
      setSelected((current) => {
        if (current && next.some((printer) => printer.name === current)) {
          return current
        }
        return next.find((printer) => printer.isDefault)?.name || next[0]?.name || ''
      })
    } catch (err) {
      setError(err.message || 'Could not load printers')
      setPrinters([])
    } finally {
      setLoadingPrinters(false)
    }
  }, [printersApi])

  useEffect(() => {
    loadPrinters()
  }, [loadPrinters])

  useEffect(() => {
    if (!printersApi?.onJobStatus || !user) {
      return undefined
    }

    return printersApi.onJobStatus(async (payload) => {
      if (!payload?.trackId || !payload.status) {
        return
      }
      const [jobId, documentId = ''] = String(payload.trackId).split(':')

      setPrintJobs((current) =>
        current.map((job) =>
          job.id === jobId
            ? { ...job, status: payload.status, rawStatus: payload.rawStatus || job.rawStatus }
            : job,
        ),
      )

      try {
        const token = await user.getIdToken()
        await updatePrintJob(token, jobId, {
          status: payload.status,
          rawStatus: payload.rawStatus || '',
          ...(documentId ? { documentId } : {}),
        })
      } catch {
        // Keep the live UI status even if the API write fails.
      }
    })
  }, [printersApi, user])

  function waitForPrintAck(info) {
    return new Promise((resolve) => {
      printDoneResolverRef.current = resolve
      setPrintDoneDialog(info)
    })
  }

  function acknowledgePrintDone() {
    const resolve = printDoneResolverRef.current
    printDoneResolverRef.current = null
    setPrintDoneDialog(null)
    resolve?.()
  }

  useEffect(() => {
    if (!printDoneDialog) {
      return undefined
    }

    function onKeyDown(event) {
      if (!continueWithKeyRef.current) {
        return
      }

      const expected = continueKeyCodeRef.current || 'Space'
      if (event.code !== expected && !(expected === 'Space' && event.key === ' ')) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      acknowledgePrintDone()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [printDoneDialog])

  useEffect(() => {
    if (!printersApi?.printPdf || !user || !selected || processingRef.current) {
      return undefined
    }

    const pending = printJobs.filter(
      (job) =>
        job.source === 'mobile' &&
        (job.status === 'queued' || job.status === 'sending') &&
        !autoPrinted.current.has(job.id) &&
        (
          (Array.isArray(job.documents) && job.documents.some((doc) => doc.fileUrl)) ||
          Boolean(job.fileUrl)
        ),
    )

    if (!pending.length) {
      return undefined
    }

    async function processQueue() {
      processingRef.current = true
      try {
        for (let index = 0; index < pending.length; index += 1) {
          const job = pending[index]
          autoPrinted.current.add(job.id)
          const deviceName = selectedRef.current
          const printer = printersRef.current.find((item) => item.name === deviceName)
          const printerName = printer?.displayName || printer?.name || deviceName

          try {
            const token = await user.getIdToken()
            await updatePrintJob(token, job.id, {
              status: 'sending',
              rawStatus: 'Sending to printer',
              printerName,
              deviceName,
            })
            setPrintJobs((current) =>
              current.map((item) =>
                item.id === job.id
                  ? { ...item, status: 'sending', printerName, deviceName }
                  : item,
              ),
            )

            const docs =
              Array.isArray(job.documents) && job.documents.length > 0
                ? job.documents.filter((doc) => doc.fileUrl)
                : job.fileUrl
                  ? [
                      {
                        id: 'doc-1',
                        documentName: job.documentName,
                        fileUrl: job.fileUrl,
                        copies: job.copies || 1,
                        localPath: job.localPath || '',
                        paperSizeName: job.paperSizeName || '',
                        paperWidth: job.paperWidth || 0,
                        paperHeight: job.paperHeight || 0,
                        paperUnit: job.paperUnit || 'in',
                      },
                    ]
                  : []

            let lastLocalPath = ''
            for (const doc of docs) {
              const printed = await printersApi.printPdf({
                trackId: `${job.id}:${doc.id || 'doc'}`,
                documentName: doc.documentName || job.documentName,
                fileUrl: doc.fileUrl,
                copies: doc.copies || job.copies || 1,
                deviceName,
                printerName,
                customerName: job.customerName || '',
                customerEmail: job.customerEmail || '',
                createdAt: job.createdAt || '',
                orderNumber: job.orderNumber || '',
                paperSizeName: doc.paperSizeName || job.paperSizeName || '',
                paperWidth: doc.paperWidth || 0,
                paperHeight: doc.paperHeight || 0,
                paperUnit: doc.paperUnit || 'in',
              })
              lastLocalPath = printed?.localPath || printed?.savedPath || lastLocalPath
              if (doc.id) {
                await updatePrintJob(token, job.id, {
                  status: 'printing',
                  rawStatus: 'In Windows print queue',
                  printerName,
                  deviceName,
                  documentId: doc.id,
                  localPath: printed?.localPath || printed?.savedPath || '',
                })
              }
            }

            await updatePrintJob(token, job.id, {
              status: 'printed',
              rawStatus: 'Printed',
              printerName,
              deviceName,
              localPath: lastLocalPath,
            })
            setPrintJobs((current) =>
              current.map((item) =>
                item.id === job.id
                  ? {
                      ...item,
                      status: 'printed',
                      rawStatus: 'Printed',
                      localPath: lastLocalPath || item.localPath || '',
                    }
                  : item,
              ),
            )

            const hasMore = index < pending.length - 1
            await waitForPrintAck({
              orderNumber: job.orderNumber || job.id,
              docCount: docs.length,
              customerName: job.customerName || job.customerEmail || '',
              hasMore,
            })
          } catch (err) {
            autoPrinted.current.delete(job.id)
            try {
              const token = await user.getIdToken()
              await updatePrintJob(token, job.id, {
                status: 'failed',
                rawStatus: err.message || 'Print failed',
              })
            } catch {
              // Ignore follow-up write errors.
            }
            setPrintJobs((current) =>
              current.map((item) =>
                item.id === job.id
                  ? { ...item, status: 'failed', rawStatus: err.message || 'Print failed' }
                  : item,
              ),
            )
            setError(err.message || `Could not print ${job.documentName}`)
          }
        }
      } finally {
        processingRef.current = false
      }
    }

    processQueue()
    return undefined
  }, [printJobs, printersApi, selected, user])

  async function handleTestPrint() {
    if (!printersApi || !selected || !user) {
      return
    }

    setPrinting(true)
    setError('')
    setSuccess('')
    const printer = printers.find((item) => item.name === selected)
    const printerName = printer?.displayName || printer?.name || selected
    const documentName = `Printstack-test-${Date.now()}`
    let job

    try {
      const token = await user.getIdToken()
      try {
        const created = await createPrintJob(token, {
          documentName,
          printerName,
          deviceName: selected,
        })
        job = created.printJob
      } catch (apiError) {
        job = {
          id: `local-${Date.now()}`,
          documentName,
          printerName,
          deviceName: selected,
          status: 'sending',
          source: 'desktop',
        }
        console.warn('[print] could not save print job', apiError)
      }
      setPrintJobs((current) => [job, ...current.filter((item) => item.id !== job.id)].slice(0, 30))

      await printersApi.testPrint({
        trackId: job.id,
        documentName,
        deviceName: selected,
        printerName,
        companyName: profile?.companyName || profile?.email || 'Printstack',
      })
      setSuccess(`Watching ${printerName} for print status.`)
    } catch (err) {
      setError(err.message || 'Could not print the test page')
    } finally {
      setPrinting(false)
    }
  }

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return printJobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false
      }
      if (sourceFilter !== 'all' && (job.source || 'desktop') !== sourceFilter) {
        return false
      }
      if (!q) {
        return true
      }
      const haystack = [
        job.orderNumber,
        job.documentName,
        job.customerName,
        job.customerEmail,
        job.paperSizeName,
        job.printerName,
        ...(Array.isArray(job.documents)
          ? job.documents.map((doc) => doc.documentName)
          : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [printJobs, search, sourceFilter, statusFilter])

  const selectableJobs = useMemo(
    () =>
      filteredJobs.filter(
        (job) =>
          Boolean(job.fileUrl) ||
          (Array.isArray(job.documents) && job.documents.some((doc) => doc.fileUrl)),
      ),
    [filteredJobs],
  )

  const allFilteredSelected =
    selectableJobs.length > 0 && selectableJobs.every((job) => selectedJobIds.has(job.id))

  const selectedJobs = useMemo(
    () => filteredJobs.filter((job) => selectedJobIds.has(job.id)),
    [filteredJobs, selectedJobIds],
  )

  useEffect(() => {
    const visible = new Set(filteredJobs.map((job) => job.id))
    setSelectedJobIds((current) => {
      let changed = false
      const next = new Set()
      current.forEach((id) => {
        if (visible.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [filteredJobs])

  function toggleJobSelection(jobId) {
    setSelectedJobIds((current) => {
      const next = new Set(current)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelectedJobIds((current) => {
      if (allFilteredSelected) {
        const next = new Set(current)
        selectableJobs.forEach((job) => next.delete(job.id))
        return next
      }
      const next = new Set(current)
      selectableJobs.forEach((job) => next.add(job.id))
      return next
    })
  }

  const reprintDocument = useCallback(
    async (job, doc) => {
      if (!printersApi?.printPdf || !selected || !user || !doc?.fileUrl) {
        throw new Error('Select a printer and a document with a PDF to reprint')
      }

      const deviceName = selected
      const printer = printers.find((item) => item.name === deviceName)
      const printerName = printer?.displayName || printer?.name || deviceName
      const token = await user.getIdToken()
      const documentId = doc.id || 'doc-1'

      await updatePrintJob(token, job.id, {
        status: 'sending',
        rawStatus: 'Reprinting',
        printerName,
        deviceName,
        documentId,
      })

      const printed = await printersApi.printPdf({
        trackId: `${job.id}:${documentId}`,
        documentName: doc.documentName || job.documentName,
        fileUrl: doc.fileUrl,
        copies: doc.copies || job.copies || 1,
        deviceName,
        printerName,
        customerName: job.customerName || '',
        customerEmail: job.customerEmail || '',
        createdAt: job.createdAt || '',
        orderNumber: job.orderNumber || '',
        paperSizeName: doc.paperSizeName || job.paperSizeName || '',
        paperWidth: doc.paperWidth || 0,
        paperHeight: doc.paperHeight || 0,
        paperUnit: doc.paperUnit || 'in',
        reprint: true,
      })

      await updatePrintJob(token, job.id, {
        status: 'reprint_queued',
        rawStatus: 'Reprint added to Windows print queue',
        printerName,
        deviceName,
        documentId,
        localPath: printed?.localPath || printed?.savedPath || doc.localPath || '',
      })
    },
    [printers, printersApi, selected, user],
  )

  const reprintJob = useCallback(
    async (job) => {
      const docs = orderDocuments(job).filter((doc) => doc.fileUrl)
      if (!docs.length) {
        throw new Error('Select a printer and a job with a PDF to reprint')
      }
      for (const doc of docs) {
        await reprintDocument(job, doc)
      }
    },
    [reprintDocument],
  )

  async function handleReprint(job) {
    const docs = orderDocuments(job).filter((doc) => doc.fileUrl)
    if (!docs.length) {
      return
    }
    setError('')
    setSuccess('')
    setReprintingId(job.id)
    try {
      await reprintJob(job)
      setSuccess(
        `Reprinted order #${job.orderNumber || job.id} (${docs.length} doc${docs.length === 1 ? '' : 's'})`,
      )
    } catch (err) {
      setError(err.message || `Could not reprint order #${job.orderNumber || job.id}`)
      try {
        const token = await user.getIdToken()
        await updatePrintJob(token, job.id, {
          status: 'failed',
          rawStatus: err.message || 'Reprint failed',
        })
      } catch {
        // Ignore follow-up write errors.
      }
    } finally {
      setReprintingId('')
    }
  }

  async function handleReprintDocument(doc) {
    const job = printJobs.find((item) => item.id === openOrderId)
    if (!job || !doc?.fileUrl) {
      return
    }
    setError('')
    setSuccess('')
    setReprintingDocId(doc.id)
    try {
      await reprintDocument(job, doc)
      setSuccess(`Reprinted ${doc.documentName || 'document'}`)
    } catch (err) {
      setError(err.message || `Could not reprint ${doc.documentName || 'document'}`)
      try {
        const token = await user.getIdToken()
        await updatePrintJob(token, job.id, {
          status: 'failed',
          rawStatus: err.message || 'Reprint failed',
          documentId: doc.id,
        })
      } catch {
        // Ignore follow-up write errors.
      }
      throw err
    } finally {
      setReprintingDocId('')
    }
  }

  async function handleBulkReprint() {
    const jobs = selectedJobs.filter((job) => orderDocuments(job).some((doc) => doc.fileUrl))
    if (!jobs.length) {
      setError('Select jobs with PDFs to reprint')
      return
    }
    if (!selected) {
      setError('Select a printer first')
      return
    }

    setBulkReprinting(true)
    setError('')
    setSuccess('')
    let done = 0
    try {
      for (const job of jobs) {
        setReprintingId(job.id)
        await reprintJob(job)
        done += 1
      }
      setSuccess(`Reprinted ${done} order${done === 1 ? '' : 's'}`)
      setSelectedJobIds(new Set())
    } catch (err) {
      setError(err.message || 'Bulk reprint failed')
    } finally {
      setReprintingId('')
      setBulkReprinting(false)
    }
  }

  const openOrder = openOrderId
    ? printJobs.find((job) => job.id === openOrderId) || null
    : null

  useEffect(() => {
    if (openOrderId && !printJobs.some((job) => job.id === openOrderId)) {
      setOpenOrderId('')
    }
  }, [openOrderId, printJobs])

  const printSuccessDialog = (
    <Dialog
      open={Boolean(printDoneDialog)}
      onClose={acknowledgePrintDone}
      fullWidth
      maxWidth="xs"
      disableRestoreFocus
    >
      <DialogTitle>Print successful</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {printDoneDialog
            ? [
                `Order #${printDoneDialog.orderNumber} printed successfully`,
                printDoneDialog.docCount
                  ? ` (${printDoneDialog.docCount} document${printDoneDialog.docCount === 1 ? '' : 's'})`
                  : '',
                printDoneDialog.customerName ? ` for ${printDoneDialog.customerName}` : '',
                '.',
                printDoneDialog.hasMore
                  ? ' Continue when you are ready for the next order.'
                  : '',
              ].join('')
            : ''}
        </DialogContentText>
        {continueWithKey ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Press <strong>{continueKey.label || 'Space'}</strong> to{' '}
            {printDoneDialog?.hasMore ? 'continue to the next order' : 'dismiss'}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          variant="contained"
          onClick={acknowledgePrintDone}
          autoFocus={!continueWithKey}
        >
          {printDoneDialog?.hasMore ? 'Continue to next order' : 'OK'}
        </Button>
      </DialogActions>
    </Dialog>
  )

  if (openOrder) {
    return (
      <Stack spacing={{ xs: 1.25, sm: 1.5 }} sx={{ width: '100%', minWidth: 0 }}>
        {!printersApi ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Open Printstack in the desktop app to list printers and send a test print.
          </Alert>
        ) : null}
        {jobsError ? (
          <Alert severity="warning" sx={{ py: 0 }}>
            {jobsError}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ py: 0 }}>
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert severity="success" sx={{ py: 0 }}>
            {success}
          </Alert>
        ) : null}
        <OrderDocumentsPage
          job={openOrder}
          onBack={() => {
            setOpenOrderId('')
            setError('')
            setSuccess('')
            setReprintingDocId('')
          }}
          onReprintDocument={handleReprintDocument}
          reprintingDocId={reprintingDocId}
          reprintDisabled={bulkReprinting || !printersApi || !selected}
          printersReady={Boolean(printersApi && selected)}
        />
        {printSuccessDialog}
      </Stack>
    )
  }

  return (
    <Stack spacing={{ xs: 1.25, sm: 1.5 }} sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.25}
        alignItems={{ lg: 'flex-start' }}
        justifyContent="space-between"
        sx={{ width: '100%', minWidth: 0 }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
          <PageHeader title="Printing" subtitle="Queue, preview, and send jobs to your printer" />
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.75}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ width: { xs: '100%', lg: 'auto' }, flexShrink: 0, minWidth: 0 }}
        >
          <TextField
            select
            size="small"
            label="Printer"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={!printersApi || loadingPrinters || printers.length === 0}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              minWidth: { sm: 200 },
              flex: { sm: '1 1 220px' },
              maxWidth: { sm: '100%', lg: 280 },
            }}
          >
            {printers.map((printer) => (
              <MenuItem key={printer.name} value={printer.name}>
                {printer.displayName || printer.name}
                {printer.isDefault ? ' (default)' : ''}
              </MenuItem>
            ))}
          </TextField>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}
            sx={{ flexShrink: 0 }}
          >
            <Tooltip title="Refresh printers">
              <span>
                <IconButton
                  size="small"
                  onClick={loadPrinters}
                  disabled={!printersApi || loadingPrinters}
                  aria-label="Refresh printers"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handleTestPrint}
              disabled={!printersApi || !selected || printing || loadingPrinters}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {printing ? 'Sending…' : 'Test print'}
            </Button>
          </Stack>
        </Stack>
      </Stack>

      {!printersApi ? (
        <Alert severity="info" sx={{ py: 0 }}>
          Open Printstack in the desktop app to list printers and send a test print.
        </Alert>
      ) : null}
      {jobsError ? (
        <Alert severity="warning" sx={{ py: 0 }}>
          {jobsError}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ py: 0 }}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ py: 0 }}>
          {success}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          width: '100%',
          minWidth: 0,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'minmax(0, 1fr) minmax(140px, 160px) minmax(130px, 150px)',
          },
        }}
      >
        {jobsLoading ? (
          <>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
          </>
        ) : (
          <>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search jobs…"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              fullWidth
            >
              {STATUS_FILTERS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Source"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              fullWidth
            >
              {SOURCE_FILTERS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
      </Box>

      {jobsLoading ? (
        <PrintJobsSkeleton />
      ) : (
        <>
          {filteredJobs.length > 0 ? (
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
                    checked={allFilteredSelected}
                    indeterminate={selectedJobs.length > 0 && !allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    disabled={selectableJobs.length === 0 || bulkReprinting}
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    Select all
                  </Typography>
                }
              />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
                {selectedJobs.length > 0
                  ? `${selectedJobs.length} selected`
                  : `${selectableJobs.length} reprintable`}
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<ReplayIcon />}
                onClick={handleBulkReprint}
                disabled={
                  selectedJobs.length === 0 ||
                  !printersApi ||
                  !selected ||
                  bulkReprinting ||
                  Boolean(reprintingId)
                }
              >
                {bulkReprinting
                  ? 'Reprinting…'
                  : `Reprint selected${selectedJobs.length ? ` (${selectedJobs.length})` : ''}`}
              </Button>
              {selectedJobs.length > 0 ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setSelectedJobIds(new Set())}
                  disabled={bulkReprinting}
                >
                  Clear
                </Button>
              ) : null}
            </Paper>
          ) : null}

          <PrintJobCards
            jobs={filteredJobs}
            selectedIds={selectedJobIds}
            onToggleSelect={toggleJobSelection}
            onOpenOrder={(job) => {
              setOpenOrderId(job.id)
              setError('')
              setSuccess('')
            }}
            onReprint={handleReprint}
            reprintingId={reprintingId}
            reprintDisabled={bulkReprinting || !printersApi || !selected}
            emptyMessage={
              printJobs.length === 0
                ? 'Mobile and desktop orders will show up here. Open an order to view its documents.'
                : 'No jobs match the current filters.'
            }
          />
        </>
      )}
      {printSuccessDialog}
    </Stack>
  )
}
