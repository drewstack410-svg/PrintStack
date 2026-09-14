import DashboardIcon from '@mui/icons-material/Dashboard'
import PrintIcon from '@mui/icons-material/Print'
import QueueIcon from '@mui/icons-material/ViewList'
import { Stack } from '@mui/material'
import { useAuth } from '../auth/AuthProvider'
import PageHeader from '../components/dashboard/PageHeader'
import StatCard from '../components/dashboard/StatCard'
import { displayName } from '../users'

const STATS = [
  { label: 'Jobs in queue', value: '5', icon: <QueueIcon color="primary" fontSize="small" /> },
  { label: 'Printers online', value: '2', icon: <PrintIcon color="primary" fontSize="small" /> },
  { label: 'Ready to print', value: '1', icon: <DashboardIcon color="primary" fontSize="small" /> },
]

export default function DashboardPage() {
  const { profile, isSuperAdmin } = useAuth()

  return (
    <Stack spacing={1.5}>
      <PageHeader
        title={isSuperAdmin ? 'Dashboard' : 'Admin dashboard'}
        subtitle={`Signed in as ${displayName(profile) || profile?.email}`}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
        {STATS.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} value={stat.value} label={stat.label} />
        ))}
      </Stack>
    </Stack>
  )
}
