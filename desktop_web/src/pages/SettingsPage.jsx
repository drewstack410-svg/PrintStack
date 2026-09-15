import { useCallback, useEffect, useState } from 'react'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { getDesktopApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'

export default function SettingsPage() {
  const { isSuperAdmin, isAdmin } = useAuth()
  const settingsApi = getDesktopApi()?.settings
  const [folderInfo, setFolderInfo] = useState(null)
  const [loading, setLoading] = useState(Boolean(settingsApi))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refreshFolder = useCallback(async () => {
    if (!settingsApi?.getPrintJobsFolder) {
      setFolderInfo(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      setFolderInfo(await settingsApi.getPrintJobsFolder())
    } catch (err) {
      setError(err.message || 'Could not load print folder settings')
    } finally {
      setLoading(false)
    }
  }, [settingsApi])

  useEffect(() => {
    refreshFolder()
  }, [refreshFolder])

  async function handlePickFolder() {
    if (!settingsApi?.pickPrintJobsFolder) {
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await settingsApi.pickPrintJobsFolder()
      if (result?.canceled) {
        return
      }
      setFolderInfo(result)
      setMessage('Print jobs will save here.')
    } catch (err) {
      setError(err.message || 'Could not update folder')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetFolder() {
    if (!settingsApi?.resetPrintJobsFolder) {
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setFolderInfo(await settingsApi.resetPrintJobsFolder())
      setMessage('Restored default folder.')
    } catch (err) {
      setError(err.message || 'Could not restore default folder')
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenFolder() {
    if (!settingsApi?.openPrintJobsFolder) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await settingsApi.openPrintJobsFolder()
    } catch (err) {
      setError(err.message || 'Could not open folder')
    } finally {
      setBusy(false)
    }
  }

  const canManagePrintFolder = Boolean(settingsApi) && (isAdmin || isSuperAdmin)

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
      <PageHeader title="Settings" subtitle="Desktop preferences" />

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          Print folder
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Where cloud / mobile print PDFs are saved
        </Typography>

        {!settingsApi ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Use the desktop app to set a local folder.
          </Alert>
        ) : !canManagePrintFolder ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Partner admin access required.
          </Alert>
        ) : loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'ui-monospace, Consolas, monospace', wordBreak: 'break-all' }}
            >
              {folderInfo?.currentPath || '—'}
              {!folderInfo?.isDefault ? (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                  (custom)
                </Typography>
              ) : null}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="small"
                startIcon={<FolderOpenIcon />}
                onClick={handlePickFolder}
                disabled={busy}
              >
                Choose folder
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenFolder}
                disabled={busy || !folderInfo?.currentPath}
              >
                Open
              </Button>
              <Button
                variant="text"
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={handleResetFolder}
                disabled={busy || folderInfo?.isDefault}
              >
                Default
              </Button>
            </Stack>
          </Stack>
        )}

        {message ? (
          <Alert severity="success" sx={{ mt: 1, py: 0 }}>
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
            {error}
          </Alert>
        ) : null}
      </Paper>
    </Stack>
  )
}
