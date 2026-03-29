import type { CampaignStatus } from '@/types'

const statusLabels: Record<CampaignStatus, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  stopped: 'הופסק',
}

const statusClasses: Record<CampaignStatus, string> = {
  active: 'status-active',
  paused: 'status-paused',
  stopped: 'status-stopped',
}

interface StatusBadgeProps {
  status: CampaignStatus
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <span className={`chip ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  )
}
