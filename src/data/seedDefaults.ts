import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { defaultSettings } from '@/domain/types'
import { userDoc } from './converters'

/** Crea el perfil con ajustes por defecto en el primer arranque. */
export async function ensureUserSeeded(user: User): Promise<void> {
  const ref = userDoc(user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    displayName: user.displayName ?? null,
    locale: 'es',
    createdAt: serverTimestamp(),
    settings: defaultSettings,
  })
}
