import { useState } from 'react'
import { Pencil, Megaphone, ChevronDown, DollarSign, PlayCircle, PlusCircle } from 'lucide-react'
import type { CampaignWithBudget, Platform, CampaignStatus, ChangelogAction } from '@/types'
import { useChangelog } from '@/hooks/useChangelog'
import { StatusDropdown } from '@/components/StatusDropdown'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDateTime } from '@/lib/format'

/* ── Inline changelog row ── */

const actionIcons: Record<ChangelogAction, typeof DollarSign> = {
  budget_change: DollarSign,
  status_change: PlayCircle,
  campaign_added: PlusCircle,
  campaign_removed: PlusCircle,
  note_added: PlusCircle,
}

const actionColors: Record<ChangelogAction, string> = {
  budget_change: 'text-accent',
  status_change: 'text-warning',
  campaign_added: 'text-success',
  campaign_removed: 'text-danger',
  note_added: 'text-text-secondary',
}

const ChangelogRow = ({ campaignId, colSpan }: { campaignId: string; colSpan: number }) => {
  const { data: entries, isLoading } = useChangelog(campaignId)

  return (
    <tr>
      <td colSpan={colSpan} className="!p-0">
        <div className="bg-[rgba(255,255,255,0.02)] border-t border-[rgba(255,255,255,0.04)] px-5 py-3">
          {isLoading ? (
            <div className="flex flex-col gap-2 py-2">
              <Skeleton width="70%" height="14px" />
              <Skeleton width="50%" height="14px" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="text-xs text-text-muted py-1">אין שינויים עדיין</p>
          ) : (
            <div className="flex flex-col gap-1">
              {entries.slice(0, 5).map((entry) => {
                const Icon = actionIcons[entry.action] ?? PlusCircle
                const color = actionColors[entry.action] ?? 'text-text-secondary'
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5">
                    <div className={`w-6 h-6 rounded-md bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0 ${color}`}>
                      <Icon size={12} />
                    </div>
                    <span className="text-xs flex-1">{entry.description}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {formatDateTime(entry.performed_at)}
                    </span>
                  </div>
                )
              })}
              {entries.length > 5 && (
                <p className="text-xs text-text-muted pt-1">ועוד {entries.length - 5} שינויים...</p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ── Campaign Table ── */

interface CampaignTableProps {
  campaigns: CampaignWithBudget[]
  platform: Platform
  onEditCampaign: (campaign: CampaignWithBudget) => void
  onViewChangelog: (campaignId: string) => void
  onBudgetEdit: (campaign: CampaignWithBudget) => void
  onStatusChange: (campaignId: string, status: CampaignStatus) => void
}

const platformLabels: Record<Platform, string> = {
  facebook: 'Meta (Facebook)',
  google: 'Google Ads',
}

const COL_COUNT = 7

export const CampaignTable = ({
  campaigns,
  platform,
  onEditCampaign,
  onBudgetEdit,
  onStatusChange,
}: CampaignTableProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const platformCampaigns = campaigns.filter((c) => c.platform === platform)

  if (platformCampaigns.length === 0) return null

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalDaily = platformCampaigns.reduce((sum, c) => sum + c.current_daily_budget, 0)
  const totalForecast = platformCampaigns.reduce((sum, c) => sum + c.monthly_forecast, 0)
  const totalOriginal = platformCampaigns.reduce((sum, c) => sum + c.original_plan, 0)
  const totalVariance = totalForecast - totalOriginal

  return (
    <div className="mb-8">
      {/* Platform header */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <PlatformIcon platform={platform} size={20} />
        <h3 className="text-lg font-semibold leading-tight">
          {platformLabels[platform]}
        </h3>
        <span className="chip text-xs">{platformCampaigns.length} קמפיינים</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)]">
        <table className="glass-table">
          <thead>
            <tr>
              <th>קמפיין</th>
              <th>סטטוס</th>
              <th>תקציב יומי</th>
              <th>צפי חודשי</th>
              <th>תוכנית מקורית</th>
              <th>הפרש</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {platformCampaigns.map((campaign) => {
              const isExpanded = expandedIds.has(campaign.id)
              return (
                <>
                  <tr key={campaign.id}>
                    {/* Campaign name */}
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium">{campaign.name}</span>
                        {campaign.campaign_type && (
                          <span className="text-xs text-text-muted mt-0.5">{campaign.campaign_type}</span>
                        )}
                      </div>
                    </td>

                    {/* Status dropdown */}
                    <td>
                      <StatusDropdown
                        status={campaign.status}
                        onChange={(s) => onStatusChange(campaign.id, s)}
                      />
                    </td>

                    {/* Daily budget — clickable */}
                    <td>
                      <button
                        className="group flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer"
                        onClick={() => onBudgetEdit(campaign)}
                        title="שינוי תקציב"
                      >
                        <span className="font-semibold text-accent">
                          {formatCurrency(campaign.current_daily_budget)}
                        </span>
                        <Pencil
                          size={12}
                          className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    </td>

                    {/* Monthly forecast */}
                    <td className="font-semibold">
                      {formatCurrency(campaign.monthly_forecast)}
                    </td>

                    {/* Original plan */}
                    <td className="text-text-secondary">
                      {formatCurrency(campaign.original_plan)}
                    </td>

                    {/* Variance */}
                    <td>
                      {campaign.variance === 0 ? (
                        <span className="text-text-muted text-xs">—</span>
                      ) : (
                        <span
                          className={`chip text-xs ${
                            campaign.variance > 0 ? 'status-stopped' : 'status-active'
                          }`}
                        >
                          {campaign.variance > 0 ? '+' : ''}
                          {formatCurrency(campaign.variance)}
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="icon"
                          className="!w-8 !h-8"
                          onClick={() => onEditCampaign(campaign)}
                          title="עריכת קמפיין"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="icon"
                          className={`!w-8 !h-8 ${isExpanded ? '!bg-[rgba(255,255,255,0.1)]' : ''}`}
                          onClick={() => toggleExpand(campaign.id)}
                          title="היסטוריית שינויים"
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable changelog row */}
                  {isExpanded && (
                    <ChangelogRow key={`${campaign.id}-log`} campaignId={campaign.id} colSpan={COL_COUNT} />
                  )}
                </>
              )
            })}

            {/* Summary row */}
            <tr className="summary-row">
              <td colSpan={2}>סה״כ {platformLabels[platform]}</td>
              <td className="font-semibold">{formatCurrency(totalDaily)}</td>
              <td className="font-semibold">{formatCurrency(totalForecast)}</td>
              <td className="text-text-secondary">{formatCurrency(totalOriginal)}</td>
              <td>
                {totalVariance !== 0 && (
                  <span
                    className={`chip text-xs ${
                      totalVariance > 0 ? 'status-stopped' : 'status-active'
                    }`}
                  >
                    {totalVariance > 0 ? '+' : ''}
                    {formatCurrency(totalVariance)}
                  </span>
                )}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Empty state shown when a client has no campaigns yet */
export const NoCampaignsState = ({ onAdd }: { onAdd: () => void }) => (
  <EmptyState
    icon={<Megaphone size={40} />}
    title="אין קמפיינים עדיין"
    description="הוסף קמפיין ראשון כדי להתחיל לנהל תקציבים"
    action={
      <Button onClick={onAdd}>
        <Megaphone size={18} />
        הוסף קמפיין
      </Button>
    }
  />
)
