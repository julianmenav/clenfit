import { FirebaseError } from 'firebase/app'
import i18n from '@/i18n'

export function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return i18n.t('errors.invalid', { ns: 'auth' })
      case 'auth/email-already-in-use':
        return i18n.t('errors.inUse', { ns: 'auth' })
      case 'auth/weak-password':
        return i18n.t('errors.weakPassword', { ns: 'auth' })
    }
  }
  return i18n.t('errors.generic', { ns: 'auth' })
}
