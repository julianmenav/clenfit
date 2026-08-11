import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { matchReminders, pickMessage, type ReminderEvent } from './reminders'
import type { Reminder, ReminderTrigger, WithId } from './types'

const reminder = (
  id: string,
  trigger: ReminderTrigger,
  partial: Partial<Reminder> = {},
): WithId<Reminder> => ({
  id,
  enabled: true,
  trigger,
  routineIds: null,
  messages: ['FOCUS.'],
  createdAt: Timestamp.now(),
  ...partial,
})

const ctx = (over: Partial<{ routineId: string | null; firedIds: Set<string> }> = {}) => ({
  routineId: null,
  firedIds: new Set<string>(),
  ...over,
})

const touched: ReminderEvent = { kind: 'exerciseTouched', exerciseId: 'squat', muscle: 'quads' }

describe('matchReminders', () => {
  it('cada evento activa solo su tipo de disparador', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }),
      reminder('b', { type: 'workoutFinish' }),
      reminder('c', { type: 'beforeExercise', exerciseId: 'squat', exerciseName: 'Sentadilla' }),
      reminder('d', { type: 'beforeMuscle', muscle: 'quads' }),
    ]
    expect(matchReminders(all, { kind: 'workoutStart' }, ctx()).map((r) => r.id)).toEqual(['a'])
    expect(matchReminders(all, { kind: 'workoutFinish' }, ctx()).map((r) => r.id)).toEqual(['b'])
    expect(matchReminders(all, touched, ctx()).map((r) => r.id)).toEqual(['c', 'd'])
  })

  it('no activa ejercicios ni músculos distintos', () => {
    const all = [
      reminder('c', { type: 'beforeExercise', exerciseId: 'press', exerciseName: 'Press' }),
      reminder('d', { type: 'beforeMuscle', muscle: 'chest' }),
    ]
    expect(matchReminders(all, touched, ctx())).toEqual([])
  })

  it('respeta enabled y los ya disparados', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }, { enabled: false }),
      reminder('b', { type: 'workoutStart' }),
    ]
    expect(
      matchReminders(all, { kind: 'workoutStart' }, ctx({ firedIds: new Set(['b']) })),
    ).toEqual([])
  })

  it('filtro de rutinas: null aplica siempre; lista solo con la rutina activa', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }, { routineIds: ['r1'] }),
      reminder('b', { type: 'workoutStart' }),
    ]
    expect(matchReminders(all, { kind: 'workoutStart' }, ctx()).map((r) => r.id)).toEqual(['b'])
    expect(
      matchReminders(all, { kind: 'workoutStart' }, ctx({ routineId: 'r1' })).map((r) => r.id),
    ).toEqual(['a', 'b'])
  })
})

describe('pickMessage', () => {
  it('elige por índice proporcional y tolera extremos', () => {
    expect(pickMessage(['a', 'b', 'c'], 0)).toBe('a')
    expect(pickMessage(['a', 'b', 'c'], 0.5)).toBe('b')
    expect(pickMessage(['a', 'b', 'c'], 0.999999)).toBe('c')
    expect(pickMessage(['a', 'b', 'c'], 1)).toBe('c')
    expect(pickMessage([], 0.5)).toBeNull()
  })
})
