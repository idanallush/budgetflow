import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, Plus, History, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useCampaigns, useUpdateCampaignStatus } from '@/hooks/useCampaigns'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Button } from '@/components/ui/Button'
import { MetricCard } from '@/components/ui/MetricCard'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CampaignTable, NoCampaignsState } from '@/components/CampaignTable'
import { CampaignModal } from '@/components/CampaignModal'
import { BudgetEditDialog } from '@/components/BudgetEditDialog'
import { ChangelogPanel } from '@/components/ChangelogPanel'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, todayISO } from '@/lib/format'
import type { CampaignWithBudget, CampaignStatus } from '@/types'

export const ClientView = () => {
  const { slug } = useParams<{ slug: string }>()
  const { data: client, isLoading: clientLoading } = useClient(slug ?? '')
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(client?.id ?? '')
  const updateStatus = useUpdateCampaignStatus()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithBudget | null>(null)
  const [budgetEditCampaign, setBudgetEditCampaign] = useState<CampaignWithBudget | null>(null)
  const [changelogCampaignId, setChangelogCampaignId] = useState<string | null>(null)
  const [showClientChangelog, setShowClientChangelog] = useState(false)
  const [showTechnicalName, setShowTechnicalName] = useState(false)

  const isLoading = clientLoading || campaignsLoading

  const totalDaily = campaigns?.reduce((sum, c) => sum + c.current_daily_budget, 0) ?? 0
  const totalForecast = campaigns?.reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const fbForecast = campaigns?.filter((c) => c.platform === 'facebook')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const googleForecast = campaigns?.filter((c) => c.platform === 'google')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const totalOriginal = campaigns?.reduce((sum, c) => sum + c.original_plan, 0) ?? 0
  const totalVariance = totalForecast - totalOriginal
  const hasCampaigns = campaigns && campaigns.length > 0
  const hasFb = campaigns?.some((c) => c.platform === 'facebook')
  const hasGoogle = campaigns?.some((c) => c.platform === 'google')

  const handleStatusChange = async (campaignId: string, status: CampaignStatus) => {
    if (!client) return
    try {
      await updateStatus.mutateAsync({
        campaign_id: campaignId,
        client_id: client.id,
        status,
        end_date: status === 'stopped' ? todayISO() : undefined,
      })
      const labels: Record<CampaignStatus, string> = { active: 'פעיל', paused: 'מושהה', stopped: 'הופסק' }
      toast.success(`סטטוס שונה ל${labels[status]}`)
    } catch {
      toast.error('שגיאה בשינוי סטטוס')
    }
  }

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
      <div className="flex items-center justify-between flex-wrap gap-3">
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
            היסטוריית שינויים
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
      {hasCampaigns && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="תקציב יומי" value={formatCurrency(totalDaily)} />
          <MetricCard label="צפי חודשי" value={formatCurrency(totalForecast)} />
          <MetricCard label="Meta" value={formatCurrency(fbForecast)} />
          <MetricCard label="Google" value={formatCurrency(googleForecast)} />
        </div>
      )}

      {/* Campaign Tables */}
      <GlassPanel className="p-6">
        {/* Name toggle */}
        {hasCampaigns && (
          <div className="flex items-center justify-end mb-4">
            <button
              className="btn-ghost !rounded-[10px] !px-3 !py-1.5 text-xs flex items-center gap-2"
              onClick={() => setShowTechnicalName((v) => !v)}
            >
              {showTechnicalName ? <ToggleRight size={16} className="text-accent" /> : <ToggleLeft size={16} />}
              {showTechnicalName ? 'שם במערכת' : 'שם קמפיין'}
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !hasCampaigns ? (
          <NoCampaignsState onAdd={() => setShowAddModal(true)} />
        ) : (
          <>
            {hasFb && (
              <CampaignTable
                campaigns={campaigns}
                platform="facebook"
                onEditCampaign={setEditingCampaign}
                onViewChangelog={setChangelogCampaignId}
                onBudgetEdit={setBudgetEditCampaign}
                onStatusChange={handleStatusChange}
                showTechnicalName={showTechnicalName}
              />
            )}

            {hasGoogle && (
              <CampaignTable
                campaigns={campaigns}
                platform="google"
                onEditCampaign={setEditingCampaign}
                onViewChangelog={setChangelogCampaignId}
                onBudgetEdit={setBudgetEditCampaign}
                onStatusChange={handleStatusChange}
                showTechnicalName={showTechnicalName}
              />
            )}

            {/* Grand Total (only if both platforms exist) */}
            {hasFb && hasGoogle && (
              <div className="glass-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <span className="font-semibold text-lg">סה״כ כללי</span>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-end">
                      <p className="text-xs text-text-muted">יומי</p>
                      <p className="font-semibold">{formatCurrency(totalDaily)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-text-muted">צפי חודשי</p>
                      <p className="text-xl font-semibold text-accent">{formatCurrency(totalForecast)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-text-muted">תוכנית מקורית</p>
                      <p className="font-semibold text-text-secondary">{formatCurrency(totalOriginal)}</p>
                    </div>
                    {totalVariance !== 0 && (
                      <div className="text-end">
                        <p className="text-xs text-text-muted">הפרש</p>
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

      {/* Modals & Panels */}
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
        title={showClientChangelog ? `היסטוריית שינויים — ${client?.name}` : undefined}
      />
    </div>
  )
}
