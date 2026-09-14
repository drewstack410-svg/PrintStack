import { useCallback, useEffect, useMemo, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { createPartner, deletePartner, listPartners, updatePartner } from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import DeletePartnerDialog from '../components/partners/DeletePartnerDialog'
import PartnerCard from '../components/partners/PartnerCard'
import PartnerDialog from '../components/partners/PartnerDialog'
import PartnersToolbar from '../components/partners/PartnersToolbar'
import { filterPartners } from '../components/partners/filterPartners'

export default function PartnersPage() {
  const { user } = useAuth()
  const [partners, setPartners] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState('all')
  const [sort, setSort] = useState('newest')

  const filteredPartners = useMemo(
    () => filterPartners(partners, { query, added, sort }),
    [added, partners, query, sort],
  )

  const loadPartners = useCallback(async ({ silent = false } = {}) => {
    if (!user) {
      return
    }

    if (!silent) {
      setLoading(true)
    }
    setError('')
    try {
      const token = await user.getIdToken()
      const payload = await listPartners(token)
      setPartners(payload.partners || [])
    } catch (err) {
      setError(err.message || 'Could not load partners')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    loadPartners()
  }, [loadPartners])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(partner) {
    setEditing(partner)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  async function handleSave(formData, isEdit) {
    const token = await user.getIdToken()
    if (isEdit) {
      await updatePartner(token, editing.id, formData)
    } else {
      await createPartner(token, formData)
    }
    await loadPartners({ silent: true })
  }

  async function handleDelete() {
    if (!deleting) {
      return
    }

    setDeletingNow(true)
    setError('')
    try {
      const token = await user.getIdToken()
      await deletePartner(token, deleting.id)
      setDeleting(null)
      await loadPartners({ silent: true })
    } catch (err) {
      setError(err.message || 'Could not delete partner')
    } finally {
      setDeletingNow(false)
    }
  }

  function clearFilters() {
    setQuery('')
    setAdded('all')
    setSort('newest')
  }

  const hasActiveFilters = Boolean(query.trim()) || added !== 'all' || sort !== 'newest'

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PageHeader title="Partners" />
          {!loading && partners.length > 0 ? (
            <Chip
              size="small"
              label={hasActiveFilters ? `${filteredPartners.length} of ${partners.length}` : partners.length}
            />
          ) : null}
        </Stack>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add partner
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ py: 0 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 1.25,
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={84} />
          ))}
        </Box>
      ) : partners.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <HandshakeOutlinedIcon color="primary" sx={{ fontSize: 28, mb: 0.5 }} />
          <Typography fontWeight={700}>No partners yet</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, mb: 1.5 }}>
            Add a company to create their login account.
          </Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add partner
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          <PartnersToolbar
            query={query}
            added={added}
            sort={sort}
            onQueryChange={setQuery}
            onAddedChange={setAdded}
            onSortChange={setSort}
          />
          {filteredPartners.length === 0 ? (
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
              <Typography fontWeight={700}>No matching partners</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, mb: 1.5 }}>
                Try a different search or filter.
              </Typography>
              <Button size="small" onClick={clearFilters}>
                Clear filters
              </Button>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 1.25,
              }}
            >
              {filteredPartners.map((partner) => (
                <PartnerCard key={partner.id} partner={partner} onEdit={openEdit} onDelete={setDeleting} />
              ))}
            </Box>
          )}
        </Stack>
      )}

      <PartnerDialog open={dialogOpen} partner={editing} onClose={closeDialog} onSubmit={handleSave} />
      <DeletePartnerDialog
        open={Boolean(deleting)}
        partner={deleting}
        loading={deletingNow}
        onClose={() => {
          if (!deletingNow) {
            setDeleting(null)
          }
        }}
        onConfirm={handleDelete}
      />
    </Stack>
  )
}
