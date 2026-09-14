import { useCallback, useEffect, useMemo, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import { Alert, Button, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { createStaff, deleteStaff, listStaffs, updateStaff } from '../api'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import PartnersToolbar from '../components/partners/PartnersToolbar'
import DeleteStaffDialog from '../components/staffs/DeleteStaffDialog'
import StaffDialog from '../components/staffs/StaffDialog'
import StaffsTable from '../components/staffs/StaffsTable'
import { filterStaffs } from '../components/staffs/filterStaffs'

export default function StaffsPage() {
  const { user } = useAuth()
  const [staffs, setStaffs] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deletingNow, setDeletingNow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState('all')
  const [sort, setSort] = useState('newest')

  const filteredStaffs = useMemo(
    () => filterStaffs(staffs, { query, added, sort }),
    [added, query, sort, staffs],
  )

  const loadStaffs = useCallback(async ({ silent = false } = {}) => {
    if (!user) {
      return
    }

    if (!silent) {
      setLoading(true)
    }
    setError('')
    try {
      const token = await user.getIdToken()
      const payload = await listStaffs(token)
      setStaffs(payload.staffs || [])
    } catch (err) {
      setError(err.message || 'Could not load staff')
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    loadStaffs()
  }, [loadStaffs])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(staff) {
    setEditing(staff)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  async function handleSave(payload, isEdit) {
    const token = await user.getIdToken()
    if (isEdit) {
      await updateStaff(token, editing.id, payload)
    } else {
      await createStaff(token, payload)
    }
    await loadStaffs({ silent: true })
  }

  async function handleDelete() {
    if (!deleting) {
      return
    }

    setDeletingNow(true)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteStaff(token, deleting.id)
      setDeleting(null)
      await loadStaffs({ silent: true })
    } catch (err) {
      setError(err.message || 'Could not delete staff')
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
          <PageHeader title="Staffs" />
          {!loading && staffs.length > 0 ? (
            <Chip
              size="small"
              label={hasActiveFilters ? `${filteredStaffs.length} of ${staffs.length}` : staffs.length}
            />
          ) : null}
        </Stack>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add staff
        </Button>
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
            <Skeleton variant="rounded" height={36} />
          </Stack>
        </Paper>
      ) : staffs.length === 0 ? (
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
          <PeopleOutlinedIcon color="primary" sx={{ fontSize: 28, mb: 0.5 }} />
          <Typography fontWeight={700}>No staff yet</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, mb: 1.5 }}>
            Add a staff account so they can sign in.
          </Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add staff
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
            searchPlaceholder="Search by name or email"
          />
          {filteredStaffs.length === 0 ? (
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
              <Typography fontWeight={700}>No matching staff</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, mb: 1.5 }}>
                Try a different search or filter.
              </Typography>
              <Button size="small" onClick={clearFilters}>
                Clear filters
              </Button>
            </Paper>
          ) : (
            <StaffsTable staffs={filteredStaffs} onEdit={openEdit} onDelete={setDeleting} />
          )}
        </Stack>
      )}

      <StaffDialog open={dialogOpen} staff={editing} onClose={closeDialog} onSubmit={handleSave} />
      <DeleteStaffDialog
        open={Boolean(deleting)}
        staff={deleting}
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
