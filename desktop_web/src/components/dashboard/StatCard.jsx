import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function StatCard({ icon, value, label }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          {icon}
          <Stack spacing={0}>
            <Typography variant="h6" lineHeight={1.2}>
              {value}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {label}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
