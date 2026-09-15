import { useCallback, useEffect, useState } from 'react'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { getDesktopApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import {
  DEFAULT_CONTINUE_PRINT_KEY,
  isCaptureableContinueKey,
  keyLabelFromEvent,
} from '../lib/printPreferences'

export default function SettingsPage() {
  const { isSuperAdmin, isAdmin } = useAuth()
  const settingsApi = getDesktopApi()?.settings
  const [folderInfo, setFolderInfo] = useState(null)
  const [continueWithKey, setContinueWithKey] = useState(true)
  const [continueKey, setContinueKey] = useState(DEFAULT_CONTINUE_PRINT_KEY)
  const [capturingKey, setCapturingKey] = useState(false)
  const [loading, setLoading] = useState(Boolean(settingsApi))
  const [prefsLoading, setPrefsLoading] = useState(Boolean(settingsApi))
  const [busy, setBusy] = useState(false)
  const [prefsBusy, setPrefsBusy] = useState(false)
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

  const applyPreferences = useCallback((prefs) => {
    setContinueWithKey(prefs?.continuePrintWithKey !== false)
    setContinueKey({
      code: prefs?.continuePrintKeyCode || DEFAULT_CONTINUE_PRINT_KEY.code,
      label: prefs?.continuePrintKeyLabel || DEFAULT_CONTINUE_PRINT_KEY.label,
    })
  }, [])

  const refreshPreferences = useCallback(async () => {
    if (!settingsApi?.getPreferences) {
      setPrefsLoading(false)
      return
    }

    setPrefsLoading(true)
    try {
      applyPreferences(await settingsApi.getPreferences())
    } catch (err) {
      setError(err.message || 'Could not load print preferences')
    } finally {
      setPrefsLoading(false)
    }
  }, [applyPreferences, settingsApi])

  useEffect(() => {
    refreshFolder()
  }, [refreshFolder])

  useEffect(() => {
    refreshPreferences()
  }, [refreshPreferences])

  const savePreferences = useCallback(
    async (patch, successMessage) => {
      if (!settingsApi?.setPreferences) {
        return null
      }
      setPrefsBusy(true)
      setError('')
      setMessage('')
      try {
        const prefs = await settingsApi.setPreferences(patch)
        applyPreferences(prefs)
        if (successMessage) {
          setMessage(successMessage)
        }
        return prefs
      } catch (err) {
        setError(err.message || 'Could not update preference')
        return null
      } finally {
        setPrefsBusy(false)
      }
    },
    [applyPreferences, settingsApi],
  )

  useEffect(() => {
    if (!capturingKey) {
      return undefined
    }

    function onKeyDown(event) {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setCapturingKey(false)
        return
      }

      if (!isCaptureableContinueKey(event)) {
        return
      }

      const next = {
        code: event.code,
        label: keyLabelFromEvent(event),
      }
      setCapturingKey(false)
      savePreferences(
        {
          continuePrintWithKey: true,
          continuePrintKeyCode: next.code,
          continuePrintKeyLabel: next.label,
        },
        `Continue key set to ${next.label}.`,
      )
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturingKey, savePreferences])

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

  async function handleContinueToggle(event) {
    const next = event.target.checked
    await savePreferences(
      { continuePrintWithKey: next },
      next
        ? `Keyboard continue is on (${continueKey.label}).`
        : 'Keyboard continue is off. Use the dialog button instead.',
    )
  }

  const canManagePrintFolder = Boolean(settingsApi) && (isAdmin || isSuperAdmin)

  return (
    <Stack spacing={1.5} sx={{ width: '100%', maxWidth: '100%' }}>
      <PageHeader title="Settings" subtitle="Desktop preferences" />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, width: '100%' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          After print
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
          How to continue when an order finishes printing
        </Typography>

        {!settingsApi ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Use the desktop app to change print shortcuts.
          </Alert>
        ) : prefsLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={continueWithKey}
                  onChange={handleContinueToggle}
                  disabled={prefsBusy || !settingsApi?.setPreferences}
                />
              }
              label={
                <Stack spacing={0.25}>
                  <Typography variant="body2" fontWeight={600}>
                    Use a keyboard key to continue
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    After a successful print, press your chosen key to start the next order
                  </Typography>
                </Stack>
              }
              sx={{ alignItems: 'flex-start', ml: 0, mr: 0 }}
            />

            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4 }}>
                CONTINUE KEY
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                sx={{ mt: 0.75 }}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!prefsBusy && settingsApi?.setPreferences) {
                      setCapturingKey(true)
                      setMessage('')
                      setError('')
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      if (!prefsBusy && settingsApi?.setPreferences) {
                        setCapturingKey(true)
                        setMessage('')
                        setError('')
                      }
                    }
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: capturingKey ? 'primary.main' : 'divider',
                    bgcolor: capturingKey ? 'rgba(79, 124, 255, 0.06)' : 'action.hover',
                    cursor: prefsBusy ? 'default' : 'pointer',
                    opacity: continueWithKey ? 1 : 0.55,
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    {capturingKey
                      ? 'Press any key… (Esc to cancel)'
                      : continueKey.label || 'Space'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {capturingKey
                      ? 'Listening for a shortcut key'
                      : 'Click to change the key'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={prefsBusy || capturingKey}
                  onClick={() => {
                    setCapturingKey(false)
                    savePreferences(
                      {
                        continuePrintWithKey: true,
                        continuePrintKeyCode: DEFAULT_CONTINUE_PRINT_KEY.code,
                        continuePrintKeyLabel: DEFAULT_CONTINUE_PRINT_KEY.label,
                      },
                      'Continue key reset to Space.',
                    )
                  }}
                >
                  Reset to Space
                </Button>
              </Stack>
            </Box>
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, width: '100%' }}>
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
      </Paper>

      {message ? (
        <Alert severity="success" sx={{ py: 0 }}>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="warning" sx={{ py: 0 }}>
          {error}
        </Alert>
      ) : null}
    </Stack>
  )
}
