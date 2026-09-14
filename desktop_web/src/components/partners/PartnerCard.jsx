import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { Avatar, Box, Card, CardContent, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'

function formatAddedOn(iso) {
  if (!iso) {
    return 'Added date unknown'
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Added date unknown'
  }

  return `Added ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

export default function PartnerCard({ partner, onEdit, onDelete }) {
  const staffCount = Array.isArray(partner.staffUids) ? partner.staffUids.length : 0

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: 72,
          minWidth: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          p: 1,
        }}
      >
        {partner.logoUrl ? (
          <Box
            component="img"
            src={partner.logoUrl}
            alt=""
            sx={{ width: '100%', height: 48, objectFit: 'contain' }}
          />
        ) : (
          <Avatar variant="rounded" sx={{ width: 40, height: 40, fontSize: 16, fontWeight: 700 }}>
            {(partner.companyName || '?').slice(0, 1).toUpperCase()}
          </Avatar>
        )}
      </Box>
      <CardContent sx={{ flex: 1, minWidth: 0, py: 1, px: 1.25, '&:last-child': { pb: 1 } }}>
        <Stack spacing={0.5} sx={{ minWidth: 0, width: '100%' }}>
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
            <Typography variant="body1" fontWeight={700} noWrap title={partner.companyName} sx={{ minWidth: 0 }}>
              {partner.companyName}
            </Typography>
            <Stack direction="row" sx={{ flexShrink: 0 }}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => onEdit?.(partner)} aria-label={`Edit ${partner.companyName}`}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => onDelete?.(partner)} aria-label={`Delete ${partner.companyName}`}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          <Typography color="text.secondary" variant="body2" noWrap title={partner.email}>
            {partner.email}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={formatAddedOn(partner.createdAt)} />
            <Chip size="small" label={`${staffCount} staff`} />
            {partner.location?.label ? (
              <Chip size="small" color={partner.location.online ? 'primary' : 'default'} label={partner.location.label} />
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
