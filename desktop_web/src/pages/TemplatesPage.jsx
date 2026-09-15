import { useCallback, useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import { Alert, Button, Paper, Skeleton, Stack, Typography } from '@mui/material'
import {
  createPaperSize,
  deletePaperSize,
  listPaperSizes,
  resetPaperSizes,
  updatePaperSize,
} from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import DeletePaperSizeDialog from '../components/printing/DeletePaperSizeDialog'
import PaperSizeDialog from '../components/printing/PaperSizeDialog'
import PaperSizesTable from '../components/printing/PaperSizesTable'

export default function TemplatesPage() {
  const { user, isSuperAdmin } = useAuth()
  const [paperSizes, setPaperSizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
  const [editingSize, setEditingSize] = useState(null)
  const [deletingSize, setDeletingSize] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)

  const loadPaperSizes = useCallback(async () => {
    if (!user || isSuperAdmin) {
      setLoading(false)
      setPaperSizes([])
      return
    }

    setLoading(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const payload = await listPaperSizes(token)
      setPaperSizes(payload.paperSizes || [])
    } catch (err) {
      setError(err.message || 'Could not load templates')
      setPaperSizes([])
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, user])

  useEffect(() => {
    loadPaperSizes()
  }, [loadPaperSizes])

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

  async function handleApplyStandardSizes() {
    if (!user) {
      return
    }

    setResetting(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const result = await resetPaperSizes(token)
      setPaperSizes(result.paperSizes || [])
    } catch (err) {
      setError(err.message || 'Could not apply standard sizes')
    } finally {
      setResetting(false)
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
      setError(err.message || 'Could not delete template')
    } finally {
      setDeletingNow(false)
    }
  }

  if (isSuperAdmin) {
    return (
      <Stack spacing={1.5}>
        <PageHeader title="Templates" subtitle="Paper sizes offered by each partner" />
        <Alert severity="info" sx={{ py: 0 }}>
          Paper templates are managed by each partner admin under Templates.
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        gap={1}
      >
        <PageHeader title="Templates" subtitle="Paper sizes and pricing for print jobs" />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            onClick={handleApplyStandardSizes}
            disabled={loading || resetting}
          >
            {resetting ? 'Applying…' : 'Use standard sizes'}
          </Button>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateSize}>
            Add size
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ py: 0 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
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
            Apply the standard Letter / Legal / A4 set, or add a custom size.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              onClick={handleApplyStandardSizes}
              disabled={resetting}
            >
              {resetting ? 'Applying…' : 'Use standard sizes'}
            </Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateSize}>
              Add size
            </Button>
          </Stack>
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

      <PaperSizeDialog
        open={sizeDialogOpen}
        paperSize={editingSize}
        onClose={closeSizeDialog}
        onSubmit={handleSaveSize}
      />
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
