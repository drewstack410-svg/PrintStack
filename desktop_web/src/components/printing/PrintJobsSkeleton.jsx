import { Box, Paper, Skeleton, Stack } from '@mui/material'

function OrderCardSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 1.1, sm: 1.35 },
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="rounded" width={18} height={18} sx={{ mt: 0.35 }} />
            <Skeleton variant="rounded" width={40} height={40} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Skeleton width="38%" height={12} />
              <Skeleton width="62%" height={18} sx={{ mt: 0.5 }} />
              <Skeleton width="48%" height={12} sx={{ mt: 0.6 }} />
            </Box>
          </Stack>
          <Skeleton variant="rounded" width={64} height={22} />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.75,
            pt: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Box key={index}>
              <Skeleton width="40%" height={10} />
              <Skeleton width="70%" height={16} sx={{ mt: 0.4 }} />
            </Box>
          ))}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Skeleton width="42%" height={12} />
          <Skeleton variant="rounded" width={88} height={30} />
        </Stack>
      </Stack>
    </Paper>
  )
}

export default function PrintJobsSkeleton({ count = 6 }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1, sm: 1.25 },
        width: '100%',
        minWidth: 0,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
        },
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <OrderCardSkeleton key={index} />
      ))}
    </Box>
  )
}
