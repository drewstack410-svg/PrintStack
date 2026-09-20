export function authMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for this Firebase project.'
    case 'auth/missing-email':
    case 'auth/invalid-email':
      return 'Enter a valid email first.'
    case 'auth/email-already-in-use':
      return 'That email already has an account. Sign in instead.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Allow popups for this site to continue with Google.'
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Sign in another way.'
    case 'auth/network-request-failed':
      return 'Check your internet connection and try again.'
    default:
      return error?.message || 'Could not sign in.'
  }
}
