import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import i18n from '@/i18n'
import { MIN_PROGRESSION_SESSIONS } from '@/domain/report'
import type {
  Report,
  ReportExercise,
  ReportProgression,
  ReportSession,
  ReportSessionExercise,
  ReportSet,
  ReportWeek,
} from '@/domain/report'
import type { BalanceGroup, RepRange } from '@/domain/analytics'
import type { PrDisplayRow } from '@/domain/prDetails'
import { formatDuration } from './dates'
import { formatKg, formatSet } from './formatSet'

const SEP = ' · '

/**
 * Markdown for an LLM: every line is data, sections that are off are not
 * rendered, missing values print «—» so the structure stays regular.
 * Lives in lib (not domain) because it formats text with i18n and date-fns.
 */
export function renderReportMarkdown(r: Report): string {
  const out: string[] = [
    `# ${i18n.t('report:md.title')}${SEP}${r.range.fromKey} → ${r.range.toKey}`,
    '',
    ...context(r),
    '',
    ...glossary(r.exercises),
  ]
  if (r.sessions) {
    out.push('', `## ${i18n.t('report:md.sessions.title')}`, ...r.sessions.flatMap(session))
  }
  if (r.weeks) out.push('', `## ${i18n.t('report:md.weekly.title')}`, ...r.weeks.flatMap(week))
  if (r.progression) out.push('', ...progression(r.progression))
  return out.join('\n') + '\n'
}

function context(r: Report): string[] {
  return [
    `## ${i18n.t('report:md.context.title')}`,
    `- ${i18n.t('report:md.context.range', {
      from: r.range.fromKey,
      to: r.range.toKey,
      days: i18n.t('report:md.context.days', { count: r.range.days }),
      sessions: i18n.t('report:md.context.sessions', { count: r.range.sessions }),
    })}`,
    `- ${
      r.bodyWeightKg != null
        ? i18n.t('report:md.context.bodyWeight', { kg: formatKg(r.bodyWeightKg) })
        : i18n.t('report:md.context.bodyWeightUnknown')
    }`,
    `- ${i18n.t('report:md.context.formula', { formula: i18n.t(`settings:oneRm.${r.formula}`) })}`,
    `- ${i18n.t('report:md.context.units')}`,
    `- ${i18n.t('report:md.context.tags')}`,
    `- ${i18n.t('report:md.context.bodyweightNote')}`,
  ]
}

function glossary(exercises: ReportExercise[]): string[] {
  return [
    `## ${i18n.t('report:md.exercises.title')}`,
    ...exercises.map((e) => {
      const name = e.custom ? `${e.name} (${i18n.t('report:md.exercises.custom')})` : e.name
      const secondary =
        e.secondaryMuscles == null
          ? i18n.t('report:md.exercises.unknown')
          : e.secondaryMuscles.length === 0
            ? i18n.t('report:md.exercises.none')
            : e.secondaryMuscles.map((m) => i18n.t(`exercises:muscle.${m}`)).join(', ')
      const parts = [
        `${i18n.t(`exercises:muscle.${e.muscle}`)}; ${i18n.t('report:md.exercises.secondary')}: ${secondary}`,
        e.equipment != null ? i18n.t(`exercises:equipment.${e.equipment}`) : null,
        i18n.t(`exercises:measurement.${e.measurement}`),
      ].filter((p): p is string => p != null)
      return `- ${name} — ${parts.join(SEP)}`
    }),
  ]
}

function session(s: ReportSession): string[] {
  const weekday = format(parseISO(s.dateKey), 'EEEE', { locale: es })
  const header = [
    `${s.dateKey} (${weekday})`,
    s.name,
    s.durationSeconds != null ? formatDuration(s.durationSeconds) : null,
    s.bodyWeightKg != null
      ? i18n.t('report:md.sessions.bodyWeight', { kg: formatKg(s.bodyWeightKg) })
      : null,
  ].filter((p): p is string => p != null)
  const lines = [`### ${header.join(SEP)}`]
  if (s.notes) lines.push(`${i18n.t('report:md.sessions.notes')}: ${s.notes}`)
  s.exercises.forEach((ex, i) => lines.push(...sessionExercise(ex, i + 1)))
  if (s.prs.length > 0) {
    const groups = s.prs.map((g) => `${g.exerciseName}${SEP}${g.rows.map(prRow).join(SEP)}`)
    lines.push(`${i18n.t('report:md.sessions.prs')}: ${groups.join('; ')}`)
  }
  lines.push(
    i18n.t('report:md.sessions.total', { sets: s.workingSets, kg: formatKg(s.volumeKg) }),
  )
  return lines
}

function sessionExercise(ex: ReportSessionExercise, index: number): string[] {
  const rest =
    ex.restSeconds != null
      ? `${SEP}${i18n.t('report:md.sessions.rest', { seconds: ex.restSeconds })}`
      : ''
  const lines = [`${index}. ${ex.name}${rest}`]
  for (const set of ex.sets) lines.push(`   - ${setLine(set, ex.measurement)}`)
  if (ex.notes) lines.push(`   - ${i18n.t('report:md.sessions.note')}: ${ex.notes}`)
  return lines
}

function setLine(set: ReportSet, measurement: ReportSessionExercise['measurement']): string {
  const { position, type, rpe, ...fields } = set
  const text = formatSet({ ...fields, type, rpe, order: position, completed: true }, measurement)
  const rpeTag = rpe != null ? ` @${formatKg(rpe)}` : ''
  const typeTag = type !== 'normal' ? ` [${i18n.t(`workout:setTypeShort.${type}`)}]` : ''
  return `${position}: ${text}${rpeTag}${typeTag}`
}

function prRow(row: PrDisplayRow): string {
  const unit = row.display === 'mostReps' ? i18n.t('common:units.reps') : i18n.t('common:units.kg')
  const previous =
    row.previousValue != null
      ? i18n.t('report:md.sessions.prPrevious', { value: formatKg(row.previousValue) })
      : i18n.t('report:md.sessions.prFirst')
  return `${i18n.t(`workout:pr.types.${row.display}`)} ${formatKg(row.value)} ${unit} (${previous})`
}

const balanceOrder: BalanceGroup[] = ['push', 'pull', 'legs', 'core']
const repRangeOrder: RepRange[] = ['strength', 'hypertrophy', 'endurance']

function week(w: ReportWeek): string[] {
  const muscles = w.muscles.map(
    (m) =>
      `${i18n.t(`exercises:muscle.${m.muscle}`)} ${formatKg(m.direct + m.indirect)} (${formatKg(m.direct)} + ${formatKg(m.indirect)})`,
  )
  const balance = balanceOrder.map((g) => `${i18n.t(`analytics:balance.${g}`)} ${w.balance[g]}`)
  const ranges = repRangeOrder.map(
    (k) => `${i18n.t(`analytics:repRanges.${k}`)} ${w.repRanges[k]}`,
  )
  return [
    `### ${i18n.t('report:md.weekly.week', { from: w.weekStartKey, to: w.weekEndKey })}`,
    `- ${i18n.t('report:md.weekly.totals', {
      sessions: w.sessions,
      sets: w.workingSets,
      kg: formatKg(w.volumeKg),
    })}`,
    `- ${i18n.t('report:md.weekly.muscles')}: ${muscles.join(SEP)}`,
    `- ${i18n.t('report:md.weekly.balance')}: ${balance.join(SEP)}`,
    `- ${i18n.t('report:md.weekly.repRanges')}: ${ranges.join(SEP)}`,
  ]
}

function progression(list: ReportProgression[]): string[] {
  const min = MIN_PROGRESSION_SESSIONS
  const lines = [`## ${i18n.t('report:md.progression.title', { min })}`]
  if (list.length === 0) {
    lines.push(i18n.t('report:md.progression.none', { min }))
    return lines
  }
  for (const p of list) {
    lines.push(`### ${p.name}`)
    for (const pt of p.points) {
      const oneRm = formatKg(Math.round(pt.oneRm * 10) / 10)
      lines.push(`- ${pt.dateKey}: ${oneRm} kg (${formatKg(pt.weightKg)} kg × ${pt.reps})`)
    }
  }
  return lines
}
