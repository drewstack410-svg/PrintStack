import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

function formatSize(item) {
  return `${item.width} × ${item.height} ${item.unit}`
}

export default function PaperSizesTable({ paperSizes, onEdit, onDelete }) {
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
            <TableCell>Size</TableCell>
            <TableCell align="right">B&W / page</TableCell>
            <TableCell align="right">Color / page</TableCell>
            <TableCell align="right" sx={{ width: 88 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paperSizes.map((item) => (
            <TableRow
              key={item.id}
              hover
              sx={{
                '& td': { py: 0.75, borderColor: 'divider' },
                '&:last-of-type td': { borderBottom: 0 },
              }}
            >
              <TableCell>
                <Typography fontWeight={700} variant="body2">
                  {item.name}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {formatSize(item)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">
                  {peso.format(Number(item.priceBw ?? item.pricePerPiece) || 0)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">
                  {peso.format(Number(item.priceColor ?? item.pricePerPiece) || 0)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit?.(item)} aria-label={`Edit ${item.name}`}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => onDelete?.(item)} aria-label={`Delete ${item.name}`}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
