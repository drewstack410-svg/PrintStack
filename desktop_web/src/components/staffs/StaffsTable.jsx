import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Avatar, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { displayName } from '../../users'

function formatAddedOn(iso) {
  if (!iso) {
    return '—'
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function initials(staff, name) {
  const parts = String(name || '')
    .split(' ')
    .filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return (staff.email || '?').slice(0, 1).toUpperCase()
}

export default function StaffsTable({ staffs, onEdit, onDelete }) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{
              bgcolor: 'action.hover',
              '& th': { fontWeight: 700, color: 'text.secondary', py: 0.75, fontSize: 13 },
            }}
          >
            <TableCell>Staff</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Added</TableCell>
            <TableCell align="right" sx={{ width: 88 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {staffs.map((staff) => {
            const name = displayName(staff) || staff.email
            return (
              <TableRow
                key={staff.id}
                hover
                sx={{
                  '& td': { py: 0.75, borderColor: 'divider' },
                  '&:last-of-type td': { borderBottom: 0 },
                }}
              >
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      src={staff.logoUrl || undefined}
                      variant="rounded"
                      sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: 'action.hover' }}
                      slotProps={{ img: { sx: { objectFit: 'contain', p: 0.25 } } }}
                    >
                      {initials(staff, name)}
                    </Avatar>
                    <Typography fontWeight={700} variant="body2" noWrap>
                      {name}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography color="text.secondary" variant="body2" noWrap>
                    {staff.email}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2">{formatAddedOn(staff.createdAt)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit?.(staff)} aria-label={`Edit ${name}`}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete?.(staff)} aria-label={`Delete ${name}`}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
