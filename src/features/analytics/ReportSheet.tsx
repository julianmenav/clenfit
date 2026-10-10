import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subDays } from 'date-fns'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useUserProfile } from '@/data/hooks'
import {
  buildReport,
  reportRangeProblem,
  reportSections,
  type ReportSection,
} from '@/domain/report'
import type { WithId, Workout } from '@/domain/types'
import { toDateKey, weekEndKey, weekStartKey } from '@/lib/dates'
import { copyText, deliverTextFile, reportFilename } from '@/lib/download'
import { renderReportMarkdown } from '@/lib/reportMarkdown'

type Preset = '4w' | '8w' | '3m' | 'custom'
const presets: Preset[] = ['4w', '8w', '3m', 'custom']
/** Rolling windows ending today, inclusive. */
const presetDays: Record<Exclude<Preset, 'custom'>, number> = { '4w': 28, '8w': 56, '3m': 91 }

interface DateRange {
  from: string
  to: string
}

function presetRange(preset: Exclude<Preset, 'custom'>): DateRange {
  const today = new Date()
  return { from: toDateKey(subDays(today, presetDays[preset] - 1)), to: toDateKey(today) }
}

const inputClass =
  'h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base text-ink outline-none focus:border-accent'

/**
 * Two steps in one sheet: options (range + sections) → generated Markdown
 * with Descargar / Copiar. Works on the workouts the Analytics screen already
 * holds; closing the sheet returns to the options step.
 */
export function ReportSheet({
  open,
  onOpenChange,
  workouts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workouts: WithId<Workout>[]
}) {
  const { t } = useTranslation(['report', 'common'])
  const { byId, loading: indexLoading } = useExerciseIndex()
  const profile = useUserProfile()
  const [preset, setPreset] = useState<Preset>('4w')
  const [custom, setCustom] = useState<DateRange>(() => presetRange('4w'))
  const [sections, setSections] = useState<Set<ReportSection>>(() => new Set(reportSections))
  const [markdown, setMarkdown] = useState<string | null>(null)

  const range = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset)),
    [preset, custom],
  )
  const inRange = useMemo(
    () => workouts.filter((w) => w.dateKey >= range.from && w.dateKey <= range.to),
    [workouts, range],
  )
  const todayKey = toDateKey(new Date())
  const rangeProblem = reportRangeProblem(range.from, range.to, todayKey)
  // profile + custom exercises must be in: a report built before they load
  // would state the wrong formula / body weight and lose custom metadata
  const canGenerate =
    rangeProblem == null && inRange.length > 0 && profile !== undefined && !indexLoading

  function choosePreset(next: Preset) {
    // «Personalizado» starts from the dates of the preset that was active
    if (next === 'custom' && preset !== 'custom') setCustom(presetRange(preset))
    setPreset(next)
  }

  function toggleSection(section: ReportSection) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  function generate() {
    const settings = profile?.settings
    const report = buildReport({
      workouts: inRange,
      fromKey: range.from,
      toKey: range.to,
      sections: reportSections.filter((s) => sections.has(s)),
      formula: settings?.oneRmFormula ?? 'epley',
      bodyWeightKg: settings?.bodyWeightKg ?? null,
      resolveDef: (id) => byId.get(id),
      weekStartKeyOf: weekStartKey,
      weekEndKeyOf: weekEndKey,
    })
    setMarkdown(renderReportMarkdown(report))
  }

  async function copy() {
    if (markdown == null) return
    if (await copyText(markdown)) toast.success(t('report:copied'))
    else toast.error(t('report:copyFailed'))
  }

  async function download() {
    if (markdown == null) return
    const outcome = await deliverTextFile(reportFilename(range.from, range.to), markdown)
    if (outcome === 'downloaded') toast.success(t('report:downloaded'))
    else if (outcome === 'failed') toast.error(t('report:downloadFailed'))
  }

  function handleOpenChange(next: boolean) {
    if (!next) setMarkdown(null)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title={t('report:title')} tall>
      {markdown == null ? (
        <div className="flex flex-col gap-5 pt-4">
          <section>
            <h3 className="pb-2 text-sm font-medium text-ink-2">{t('report:range.title')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Chip
                  key={p}
                  label={t(`report:range.${p}`)}
                  active={preset === p}
                  onClick={() => choosePreset(p)}
                />
              ))}
            </div>
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-3">
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  {t('report:range.from')}
                  <input
                    type="date"
                    value={custom.from}
                    max={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  {t('report:range.to')}
                  <input
                    type="date"
                    value={custom.to}
                    min={custom.from}
                    max={todayKey}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {rangeProblem != null && (
              <p className="pt-2 text-xs text-ink-3">{t(`report:range.${rangeProblem}`)}</p>
            )}
          </section>

          <section>
            <h3 className="pb-2 text-sm font-medium text-ink-2">{t('report:sections.title')}</h3>
            <div className="flex flex-col gap-2">
              {reportSections.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-3 rounded-card border border-hairline p-3"
                >
                  <input
                    type="checkbox"
                    checked={sections.has(s)}
                    onChange={() => toggleSection(s)}
                    className="size-5 accent-(--accent)"
                  />
                  <span className="text-sm font-medium">{t(`report:sections.${s}`)}</span>
                </label>
              ))}
            </div>
          </section>

          <p className="text-sm text-ink-3">
            {t('report:sessionsInRange', { count: inRange.length })}
          </p>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={generate}
            className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
          >
            {t('report:generate')}
          </button>
        </div>
      ) : (
        <ReportResult
          markdown={markdown}
          sessions={inRange.length}
          onBack={() => setMarkdown(null)}
          onCopy={copy}
          onDownload={download}
        />
      )}
    </Sheet>
  )
}

function ReportResult({
  markdown,
  sessions,
  onBack,
  onCopy,
  onDownload,
}: {
  markdown: string
  sessions: number
  onBack: () => void
  onCopy: () => void
  onDownload: () => void
}) {
  const { t } = useTranslation('report')
  const lines = markdown.split('\n').length - 1
  const kb = Math.max(1, Math.round(new TextEncoder().encode(markdown).length / 1024))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
      <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="tnum">{t('size', { sessions, lines, kb })}</span>
        <button type="button" onClick={onBack} className="shrink-0 font-medium text-accent">
          {t('back')}
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-card border border-hairline bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
        {markdown}
      </pre>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="h-12 rounded-card bg-accent font-semibold text-on-accent"
        >
          {t('download')}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="h-12 rounded-card border border-hairline bg-surface font-semibold text-ink"
        >
          {t('copy')}
        </button>
      </div>
    </div>
  )
}
