import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthState {
  user: User | null
  /** true while Firebase restores the session on startup */
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }))
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

/** For screens inside RequireAuth, where user is never null. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser outside an authenticated route')
  return user
}
