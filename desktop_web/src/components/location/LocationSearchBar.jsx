import { useEffect, useId, useRef, useState } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  CircularProgress,
  ClickAwayListener,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
} from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { createPlacesSessionToken, resolvePlace, searchLocations } from '../../lib/geo'

const DEBOUNCE_MS = 280

export default function LocationSearchBar({ onSelect, disabled = false }) {
  const { user } = useAuth()
  const listId = useId()
  const requestId = useRef(0)
  const sessionTokenRef = useRef(createPlacesSessionToken())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2 || !user) {
      setResults([])
      setLoading(false)
      setError('')
      return undefined
    }

    const currentRequest = ++requestId.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const next = await searchLocations(text, token, sessionTokenRef.current)
        if (currentRequest !== requestId.current) {
          return
        }
        setResults(next)
        setOpen(true)
      } catch (err) {
        if (currentRequest !== requestId.current) {
          return
        }
        setResults([])
        setError(err.message || 'Search failed')
        setOpen(true)
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, user])

  async function handleSelect(item) {
    if (!user || resolving) {
      return
    }

    setQuery(item.label || '')
    setOpen(false)
    setResults([])
    setResolving(true)
    setError('')

    try {
      const token = await user.getIdToken()
      const place = await resolvePlace(token, {
        placeId: item.placeId || item.id || '',
        address: item.label || '',
        sessionToken: item.sessionToken || sessionTokenRef.current,
        lat: item.lat,
        lng: item.lng,
      })
      // Start a fresh autocomplete billing session after resolve.
      sessionTokenRef.current = createPlacesSessionToken()
      onSelect?.(place)
    } catch (err) {
      setError(err.message || 'Could not validate this address')
      setOpen(true)
    } finally {
      setResolving(false)
    }
  }

  const busy = loading || resolving

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: 320 }, flex: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          disabled={disabled || resolving}
          placeholder="Search shop address (Places)…"
          onChange={(event) => {
            if (!sessionTokenRef.current) {
              sessionTokenRef.current = createPlacesSessionToken()
            }
            setQuery(event.target.value)
          }}
          onFocus={() => {
            if (results.length || error) {
              setOpen(true)
            }
          }}
          slotProps={{
            input: {
              'aria-autocomplete': 'list',
              'aria-controls': listId,
              'aria-expanded': open,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: busy ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null,
            },
          }}
        />

        {open && (results.length > 0 || error) ? (
          <Paper
            elevation={6}
            sx={{
              position: 'absolute',
              zIndex: 20,
              left: 0,
              right: 0,
              top: 'calc(100% + 4px)',
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            {error ? (
              <Box sx={{ px: 1.5, py: 1.25, typography: 'body2', color: 'error.main' }}>
                {error}
              </Box>
            ) : (
              <List id={listId} dense disablePadding role="listbox">
                {results.map((item) => (
                  <ListItemButton
                    key={item.id || item.placeId || item.label}
                    role="option"
                    disabled={resolving}
                    onClick={() => handleSelect(item)}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 13,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        ) : null}
      </Box>
    </ClickAwayListener>
  )
}
