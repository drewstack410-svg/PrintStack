import { useCallback, useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, Button, IconButton, MenuItem, Paper, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import {
  createPaperSize,
  createPrintJob,
  deletePaperSize,
  getDesktopApi,
  listPaperSizes,
  listPrintJobs,
  updatePaperSize,
  updatePrintJob,
} from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import DeletePaperSizeDialog from '../components/printing/DeletePaperSizeDialog'
import PaperSizeDialog from '../components/printing/PaperSizeDialog'
import PaperSizesTable from '../components/printing/PaperSizesTable'
import PrintJobsTable from '../components/printing/PrintJobsTable'

export default function PrintingPage() {
  const { user, profile } = useAuth()
  const printersApi = getDesktopApi()?.printers
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(Boolean(printersApi))
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [paperSizes, setPaperSizes] = useState([])
  const [loadingSizes, setLoadingSizes] = useState(true)
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
  const [editingSize, setEditingSize] = useState(null)
  const [deletingSize, setDeletingSize] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)
  const [printJobs, setPrintJobs] = useState([])

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

  const loadPaperSizes = useCallback(async () => {
    if (!user) {
      return
    }

    setLoadingSizes(true)
    try {
      const token = await user.getIdToken()
      const payload = await listPaperSizes(token)
      setPaperSizes(payload.paperSizes || [])
    } catch (err) {
      setError(err.message || 'Could not load paper sizes')
    } finally {
      setLoadingSizes(false)
    }
  }, [user])

  useEffect(() => {
    loadPrinters()
  }, [loadPrinters])

  const loadPrintJobs = useCallback(async () => {
    if (!user) {
      return
    }

    try {
      const token = await user.getIdToken()
      const payload = await listPrintJobs(token)
      setPrintJobs(payload.printJobs || [])
    } catch {
      setPrintJobs([])
    }
  }, [user])

  useEffect(() => {
    loadPaperSizes()
  }, [loadPaperSizes])

  useEffect(() => {
    loadPrintJobs()
  }, [loadPrintJobs])

  useEffect(() => {
    const active = printJobs.some((job) => job.status === 'sending' || job.status === 'queued' || job.status === 'printing')
    if (!active) {
      return undefined
    }

    const timer = window.setInterval(loadPrintJobs, 2000)
    return () => window.clearInterval(timer)
  }, [loadPrintJobs, printJobs])

  useEffect(() => {
    if (!printersApi?.onJobStatus || !user) {
      return undefined
    }

    return printersApi.onJobStatus(async (payload) => {
      if (!payload?.trackId || !payload.status) {
        return
      }

      setPrintJobs((current) =>
        current.map((job) => (job.id === payload.trackId ? { ...job, status: payload.status, rawStatus: payload.rawStatus || job.rawStatus } : job)),
      )

      try {
        const token = await user.getIdToken()
        await updatePrintJob(token, payload.trackId, {
          status: payload.status,
          rawStatus: payload.rawStatus || '',
        })
      } catch {
        // Keep the live UI status even if the API write fails.
      }
    })
  }, [printersApi, user])

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
        }
        console.warn('[print] could not save print job', apiError)
      }
      setPrintJobs((current) => [job, ...current.filter((item) => item.id !== job.id)].slice(0, 12))

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

  function openCreateSize() {
    setEditingSize(null)
    setSizeDialogOpen(true)
  }

  function closeSizeDialog() {
    setSizeDialogOpen(false)
    setEditingSize(null)
  }

  async function handleSaveSize(payload) {
    const token = await user.getIdToken()
    if (editingSize) {
      const result = await updatePaperSize(token, editingSize.id, payload)
      setPaperSizes(result.paperSizes || [])
    } else {
      const result = await createPaperSize(token, payload)
      setPaperSizes(result.paperSizes || [])
    }
  }

  async function handleDeleteSize() {
    if (!deletingSize) {
      return
    }

    setDeletingNow(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const result = await deletePaperSize(token, deletingSize.id)
      setPaperSizes(result.paperSizes || [])
      setDeletingSize(null)
    } catch (err) {
      setError(err.message || 'Could not delete paper size')
    } finally {
      setDeletingNow(false)
    }
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
        <PageHeader title="Printing" />
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateSize}>
          Add size
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
        <TextField
          select
          size="small"
          label="Printer"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={!printersApi || loadingPrinters || printers.length === 0}
          sx={{ minWidth: { sm: 280 }, flex: { sm: 1 }, maxWidth: { sm: 420 } }}
        >
          {printers.map((printer) => (
            <MenuItem key={printer.name} value={printer.name}>
              {printer.displayName || printer.name}
              {printer.isDefault ? ' (default)' : ''}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Tooltip title="Refresh printers">
            <span>
              <IconButton size="small" onClick={loadPrinters} disabled={!printersApi || loadingPrinters} aria-label="Refresh printers">
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
          >
            {printing ? 'Sending…' : 'Test print'}
          </Button>
        </Stack>
      </Stack>

      {!printersApi ? (
        <Alert severity="info" sx={{ py: 0 }}>
          Open Printstack in the desktop app to list printers and send a test print.
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

      <PrintJobsTable jobs={printJobs} />

      {loadingSizes ? (
        <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={28} />
            <Skeleton variant="rounded" height={36} />
            <Skeleton variant="rounded" height={36} />
          </Stack>
        </Paper>
      ) : paperSizes.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Typography fontWeight={700}>No paper sizes yet</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, mb: 1.5 }}>
            Add a size and set its price per piece.
          </Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateSize}>
            Add size
          </Button>
        </Paper>
      ) : (
        <PaperSizesTable
          paperSizes={paperSizes}
          onEdit={(item) => {
            setEditingSize(item)
            setSizeDialogOpen(true)
          }}
          onDelete={setDeletingSize}
        />
      )}

      <PaperSizeDialog open={sizeDialogOpen} paperSize={editingSize} onClose={closeSizeDialog} onSubmit={handleSaveSize} />
      <DeletePaperSizeDialog
        open={Boolean(deletingSize)}
        paperSize={deletingSize}
        loading={deletingNow}
        onClose={() => {
          if (!deletingNow) {
            setDeletingSize(null)
          }
        }}
        onConfirm={handleDeleteSize}
      />
    </Stack>
  )
}
