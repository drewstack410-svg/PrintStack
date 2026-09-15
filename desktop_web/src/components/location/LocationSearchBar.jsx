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
import { searchLocations } from '../../lib/geo'

const DEBOUNCE_MS = 280

export default function LocationSearchBar({ onSelect, disabled = false }) {
  const { user } = useAuth()
  const listId = useId()
  const requestId = useRef(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
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
        const next = await searchLocations(text, token)
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

  function handleSelect(item) {
    setQuery(item.label || '')
    setOpen(false)
    setResults([])
    onSelect?.(item)
  }

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: 320 }, flex: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          disabled={disabled}
          placeholder="Search address or place…"
          onChange={(event) => setQuery(event.target.value)}
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
              endAdornment: loading ? (
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
                    key={item.id}
                    role="option"
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
