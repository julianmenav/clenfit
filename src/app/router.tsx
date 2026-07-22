import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { AppLayout } from './AppLayout'
import { DataBootstrap } from './DataBootstrap'
import { RedirectIfAuthed, RequireAuth } from './guards'
import { RouteError } from './RouteError'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { HomeScreen } from '@/features/dashboard/HomeScreen'
import { ActiveWorkoutScreen } from '@/features/workout/ActiveWorkoutScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { WorkoutDetailScreen } from '@/features/history/WorkoutDetailScreen'
import { WorkoutEditorScreen } from '@/features/history/WorkoutEditorScreen'
import { LibraryScreen } from '@/features/exercises/LibraryScreen'
import { ExerciseDetailScreen } from '@/features/exercises/ExerciseDetailScreen'
import { RoutinesScreen } from '@/features/routines/RoutinesScreen'
import { RoutineEditorScreen } from '@/features/routines/RoutineEditorScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'

// Recharts is only loaded when entering Analytics
const AnalyticsScreen = lazy(() =>
  import('@/features/analytics/AnalyticsScreen').then((m) => ({ default: m.AnalyticsScreen })),
)

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    errorElement: <RouteError />,
    children: [{ path: '/entrar', element: <LoginScreen /> }],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <DataBootstrap />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <HomeScreen /> },
              { path: '/entrenamiento', element: <ActiveWorkoutScreen /> },
              { path: '/historial', element: <HistoryScreen /> },
              { path: '/historial/nuevo', element: <WorkoutEditorScreen /> },
              { path: '/historial/:workoutId', element: <WorkoutDetailScreen /> },
              { path: '/historial/:workoutId/editar', element: <WorkoutEditorScreen /> },
              { path: '/ejercicios', element: <LibraryScreen /> },
              { path: '/ejercicios/:exerciseId', element: <ExerciseDetailScreen /> },
              { path: '/rutinas', element: <RoutinesScreen /> },
              { path: '/rutinas/nueva', element: <RoutineEditorScreen /> },
              { path: '/rutinas/:routineId', element: <RoutineEditorScreen /> },
              {
                path: '/analisis',
                element: (
                  <Suspense fallback={null}>
                    <AnalyticsScreen />
                  </Suspense>
                ),
              },
              { path: '/ajustes', element: <SettingsScreen /> },
            ],
          },
        ],
      },
    ],
  },
])
