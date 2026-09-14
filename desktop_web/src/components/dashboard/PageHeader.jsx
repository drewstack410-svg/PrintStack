import { Typography } from '@mui/material'

export default function PageHeader({ title, subtitle }) {
  return (
    <div>
      <Typography variant="h6">{title}</Typography>
      {subtitle ? (
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      ) : null}
    </div>
  )
}
