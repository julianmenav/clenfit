import { describe, expect, it } from 'vitest'
import '@/i18n'
import type { Report, ReportSession } from '@/domain/report'
import { renderReportMarkdown } from './reportMarkdown'

function session(partial: Partial<ReportSession>): ReportSession {
  return {
    dateKey: '2026-09-14',
    name: 'Empuje A',
    durationSeconds: 58 * 60,
    bodyWeightKg: 82,
    notes: null,
    exercises: [],
    prs: [],
    workingSets: 0,
    volumeKg: 0,
    ...partial,
  }
}

function report(partial: Partial<Report>): Report {
  return {
    range: { fromKey: '2026-09-12', toKey: '2026-10-10', days: 29, sessions: 1 },
    bodyWeightKg: 82,
    formula: 'epley',
    exercises: [],
    sessions: null,
    weeks: null,
    progression: null,
    ...partial,
  }
}

describe('renderReportMarkdown', () => {
  it('renders the title and context block', () => {
    const md = renderReportMarkdown(report({ exercises: [] }))
    expect(md).toBe(
      [
        '# Informe de entrenamiento · 2026-09-12 → 2026-10-10',
        '',
        '## Contexto',
        '- Rango: 2026-09-12 → 2026-10-10 (29 días, 1 sesión)',
        '- Peso corporal actual: 82 kg (cada sesión indica el suyo)',
        '- Fórmula 1RM: Epley',
        '- Unidades: kg · repeticiones · tiempo mm:ss · distancia km',
        '- Etiquetas de serie: [C] calentamiento (excluida de todos los totales) · [D] serie descendente · [F] al fallo · @8 = RPE 8',
        '- En ejercicios a peso corporal, el peso de la serie es lastre añadido al peso corporal.',
        '',
        '## Ejercicios',
        '',
      ].join('\n'),
    )
  })

  it('says when the body weight is not set', () => {
    const md = renderReportMarkdown(report({ bodyWeightKg: null }))
    expect(md).toContain('- Peso corporal actual: no registrado\n')
  })

  it('renders the glossary with catalog data, custom flag and unknown secondaries', () => {
    const md = renderReportMarkdown(
      report({
        exercises: [
          {
            exerciseId: 'bench',
            name: 'Press banca con barra',
            muscle: 'chest',
            secondaryMuscles: ['triceps', 'shoulders'],
            equipment: 'barbell',
            measurement: 'weight_reps',
            custom: false,
          },
          {
            exerciseId: 'mine',
            name: 'Remo rumano',
            muscle: 'back',
            secondaryMuscles: [],
            equipment: 'barbell',
            measurement: 'weight_reps',
            custom: true,
          },
          {
            exerciseId: 'gone',
            name: 'Curl raro',
            muscle: 'biceps',
            secondaryMuscles: null,
            equipment: null,
            measurement: 'weight_reps',
            custom: false,
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Ejercicios',
        '- Press banca con barra — Pecho; secundarios: Tríceps, Hombros · Barra · Peso y repeticiones',
        '- Remo rumano (personalizado) — Espalda; secundarios: ninguno · Barra · Peso y repeticiones',
        '- Curl raro — Bíceps; secundarios: desconocidos · Peso y repeticiones',
        '',
      ].join('\n'),
    )
  })

  it('renders a session with every set, tags, RPE, notes, PRs and totals', () => {
    const md = renderReportMarkdown(
      report({
        sessions: [
          session({
            notes: 'dormí mal',
            workingSets: 3,
            volumeKg: 1360,
            exercises: [
              {
                exerciseId: 'bench',
                name: 'Press banca con barra',
                measurement: 'weight_reps',
                usesBodyweight: false,
                restSeconds: 120,
                notes: 'hombro izquierdo molesto',
                sets: [
                  {
                    position: 1,
                    type: 'warmup',
                    weightKg: 40,
                    reps: 10,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: null,
                  },
                  {
                    position: 2,
                    type: 'normal',
                    weightKg: 80,
                    reps: 6,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: 8,
                  },
                  {
                    position: 3,
                    type: 'failure',
                    weightKg: 80,
                    reps: 5,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: 10,
                  },
                  {
                    position: 4,
                    type: 'dropset',
                    weightKg: 60,
                    reps: 8,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: null,
                  },
                ],
              },
              {
                exerciseId: 'dips',
                name: 'Fondos en paralelas',
                measurement: 'reps_only',
                usesBodyweight: true,
                restSeconds: null,
                notes: null,
                sets: [
                  {
                    position: 1,
                    type: 'normal',
                    weightKg: 10,
                    reps: 12,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: null,
                  },
                ],
              },
            ],
            prs: [
              {
                exerciseId: 'bench',
                exerciseName: 'Press banca con barra',
                rows: [
                  { display: 'best1Rm', value: 96, previousValue: 94 },
                  { display: 'heaviestWeight', value: 82.5, previousValue: null },
                ],
              },
              {
                exerciseId: 'dips',
                exerciseName: 'Fondos en paralelas',
                rows: [{ display: 'mostReps', value: 12, previousValue: 10 }],
              },
            ],
          }),
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Sesiones',
        '### 2026-09-14 (lunes) · Empuje A · 58 min · peso corporal 82 kg',
        'Notas: dormí mal',
        '1. Press banca con barra · descanso 120 s',
        '   - 1: 40 kg × 10 [C]',
        '   - 2: 80 kg × 6 @8',
        '   - 3: 80 kg × 5 @10 [F]',
        '   - 4: 60 kg × 8 [D]',
        '   - Nota: hombro izquierdo molesto',
        '2. Fondos en paralelas',
        '   - 1: +10 kg × 12',
        'Récords: Press banca con barra · 1RM estimado 96 kg (antes 94) · Peso máximo 82,5 kg (primera marca); Fondos en paralelas · Más repeticiones 12 reps (antes 10)',
        'Total: 3 series efectivas · 1360 kg',
        '',
      ].join('\n'),
    )
  })

  it('omits missing header pieces and the Notas/Récords lines when empty', () => {
    const md = renderReportMarkdown(
      report({ sessions: [session({ durationSeconds: null, bodyWeightKg: null })] }),
    )
    expect(md).toContain('### 2026-09-14 (lunes) · Empuje A\nTotal: 0 series efectivas · 0 kg\n')
    expect(md).not.toContain('Notas:')
    expect(md).not.toContain('Récords:')
  })

  it('formats time, weight+time and distance sets, with dashes for missing halves', () => {
    const md = renderReportMarkdown(
      report({
        sessions: [
          session({
            exercises: [
              {
                exerciseId: 'plank',
                name: 'Plancha',
                measurement: 'time_only',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [
                  {
                    position: 1,
                    type: 'normal',
                    weightKg: null,
                    reps: null,
                    durationSeconds: 90,
                    distanceMeters: null,
                    rpe: 7,
                  },
                ],
              },
              {
                exerciseId: 'carry',
                name: 'Paseo del granjero',
                measurement: 'weight_time',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [
                  {
                    position: 1,
                    type: 'normal',
                    weightKg: 32,
                    reps: null,
                    durationSeconds: null,
                    distanceMeters: null,
                    rpe: null,
                  },
                ],
              },
              {
                exerciseId: 'run',
                name: 'Carrera',
                measurement: 'distance_time',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [
                  {
                    position: 1,
                    type: 'normal',
                    weightKg: null,
                    reps: null,
                    durationSeconds: 720,
                    distanceMeters: 2500,
                    rpe: null,
                  },
                ],
              },
            ],
          }),
        ],
      }),
    )
    expect(md).toContain('1. Plancha\n   - 1: 1:30 @7\n')
    expect(md).toContain('2. Paseo del granjero\n   - 1: 32 kg · —\n')
    expect(md).toContain('3. Carrera\n   - 1: 2,5 km · 12:00\n')
  })

  it('renders the weekly summary', () => {
    const md = renderReportMarkdown(
      report({
        weeks: [
          {
            weekStartKey: '2026-09-14',
            weekEndKey: '2026-09-20',
            sessions: 4,
            workingSets: 72,
            volumeKg: 24300,
            muscles: [
              { muscle: 'chest', direct: 12, indirect: 4 },
              { muscle: 'back', direct: 14, indirect: 0 },
              { muscle: 'triceps', direct: 0, indirect: 2.5 },
            ],
            balance: { push: 30, pull: 28, legs: 14, core: 0 },
            repRanges: { strength: 20, hypertrophy: 48, endurance: 4 },
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Resumen semanal',
        '### Semana 2026-09-14 → 2026-09-20',
        '- Sesiones: 4 · Series efectivas: 72 · Volumen: 24300 kg',
        '- Series por músculo (directas + indirectas × 0,5): Pecho 16 (12 + 4) · Espalda 14 (14 + 0) · Tríceps 2,5 (0 + 2,5)',
        '- Equilibrio: Empuje 30 · Tirón 28 · Pierna 14 · Core 0',
        '- Rangos de repeticiones: Fuerza (1-5) 20 · Hipertrofia (6-12) 48 · Resistencia (13+) 4',
        '',
      ].join('\n'),
    )
  })

  it('renders the progression with one decimal, and a line when nothing qualifies', () => {
    const md = renderReportMarkdown(
      report({
        progression: [
          {
            exerciseId: 'bench',
            name: 'Press banca con barra',
            points: [
              { dateKey: '2026-09-14', oneRm: 96, weightKg: 80, reps: 6 },
              { dateKey: '2026-09-17', oneRm: 97.3125, weightKg: 82.5, reps: 5 },
            ],
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Progresión 1RM (ejercicios con 5 o más sesiones)',
        '### Press banca con barra',
        '- 2026-09-14: 96 kg (80 kg × 6)',
        '- 2026-09-17: 97,3 kg (82,5 kg × 5)',
        '',
      ].join('\n'),
    )
    expect(renderReportMarkdown(report({ progression: [] }))).toContain(
      '## Progresión 1RM (ejercicios con 5 o más sesiones)\nNingún ejercicio con 5 o más sesiones en el rango.\n',
    )
  })

  it('skips headings of sections that are off and ends with one newline', () => {
    const md = renderReportMarkdown(report({}))
    expect(md).not.toContain('## Sesiones')
    expect(md).not.toContain('## Resumen semanal')
    expect(md).not.toContain('## Progresión')
    expect(md.endsWith('\n')).toBe(true)
    expect(md.endsWith('\n\n')).toBe(false)
  })
})
