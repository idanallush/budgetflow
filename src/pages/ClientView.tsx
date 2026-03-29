import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, Plus, History, Copy } from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useCampaigns } from '@/hooks/useCampaigns'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Button } from '@/components/ui/Button'
import { MetricCard } from '@/components/ui/MetricCard'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CampaignTable } from '@/components/CampaignTable'
import { CampaignModal } from '@/components/CampaignModal'
import { BudgetEditDialog } from '@/components/BudgetEditDialog'
import { ChangelogPanel } from '@/components/ChangelogPanel'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/format'
import type { CampaignWithBudget } from '@/types'

export const ClientView = () => {
  const { slug } = useParams<{ slug: string }>()
  const { data: client, isLoading: clientLoading } = useClient(slug ?? '')
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(client?.id ?? '')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithBudget | null>(null)
  const [budgetEditCampaign, setBudgetEditCampaign] = useState<CampaignWithBudget | null>(null)
  const [changelogCampaignId, setChangelogCampaignId] = useState<string | null>(null)
  const [showClientChangelog, setShowClientChangelog] = useState(false)

  const isLoading = clientLoading || campaignsLoading

  const totalDaily = campaigns?.reduce((sum, c) => sum + c.current_daily_budget, 0) ?? 0
  const totalForecast = campaigns?.reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const fbForecast = campaigns?.filter((c) => c.platform === 'facebook')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const googleForecast = campaigns?.filter((c) => c.platform === 'google')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const totalOriginal = campaigns?.reduce((sum, c) => sum + c.original_plan, 0) ?? 0
  const totalVariance = totalForecast - totalOriginal

  const copyShareLink = () => {
    if (!client) return
    const url = `${window.location.origin}/share/${client.share_token}`
    navigator.clipboard.writeText(url)
    toast.success('קישור שיתוף הועתק')
  }

  if (!isLoading && !client) {
    return (
      <GlassPanel className="p-8 text-center">
        <p className="text-lg text-text-secondary">לקוח לא נמצא</p>
        <Link to="/" className="btn-ghost inline-flex mt-4">חזרה לדשבורד</Link>
      </GlassPanel>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">
              {client?.name ?? '...'}
            </h1>
            {client?.notes && (
              <p className="text-sm text-text-secondary mt-1">{client.notes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowClientChangelog(true)}>
            <History size={16} />
            היסטוריה
          </Button>
          <Button variant="ghost" onClick={copyShareLink}>
            <Copy size={16} />
            קישור שיתוף
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            הוסף קמפיין
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="תקציב יומי" value={formatCurrency(totalDaily)} />
        <MetricCard label="תחזית חודשית" value={formatCurrency(totalForecast)} />
        <MetricCard label="Meta" value={formatCurrency(fbForecast)} />
        <MetricCard label="Google" value={formatCurrency(googleForecast)} />
      </div>

      {/* Campaign Tables */}
      <GlassPanel className="p-6">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            <CampaignTable
              campaigns={campaigns ?? []}
              platform="facebook"
              onEditCampaign={setEditingCampaign}
              onViewChangelog={setChangelogCampaignId}
              onBudgetEdit={setBudgetEditCampaign}
            />

            <CampaignTable
              campaigns={campaigns ?? []}
              platform="google"
              onEditCampaign={setEditingCampaign}
              onViewChangelog={setChangelogCampaignId}
              onBudgetEdit={setBudgetEditCampaign}
            />

            {/* Grand Total */}
            {campaigns && campaigns.length > 0 && (
              <div className="glass-card p-5 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">סה״כ כללי</span>
                  <div className="flex items-center gap-6">
                    <div className="text-end">
                      <p className="text-xs text-text-muted">יומי</p>
                      <p className="font-semibold">{formatCurrency(totalDaily)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-text-muted">תחזית חודשית</p>
                      <p className="text-xl font-semibold text-accent">{formatCurrency(totalForecast)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-text-muted">תוכנית מקורית</p>
                      <p className="font-semibold text-text-secondary">{formatCurrency(totalOriginal)}</p>
                    </div>
                    {totalVariance !== 0 && (
                      <div className="text-end">
                        <p className="text-xs text-text-muted">סטייה</p>
                        <span className={`chip text-xs ${totalVariance > 0 ? 'status-stopped' : 'status-active'}`}>
                          {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </GlassPanel>

      {/* Modals */}
      <CampaignModal
        open={showAddModal || !!editingCampaign}
        onClose={() => {
          setShowAddModal(false)
          setEditingCampaign(null)
        }}
        clientId={client?.id ?? ''}
        campaign={editingCampaign}
      />

      <BudgetEditDialog
        open={!!budgetEditCampaign}
        onClose={() => setBudgetEditCampaign(null)}
        campaign={budgetEditCampaign}
        clientId={client?.id ?? ''}
      />

      <ChangelogPanel
        open={!!changelogCampaignId || showClientChangelog}
        onClose={() => {
          setChangelogCampaignId(null)
          setShowClientChangelog(false)
        }}
        campaignId={changelogCampaignId ?? undefined}
        clientId={showClientChangelog ? client?.id : undefined}
        title={showClientChangelog ? `היסטוריה — ${client?.name}` : undefined}
      />
    </div>
  )
}
