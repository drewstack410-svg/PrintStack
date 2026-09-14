export function authMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this Firebase project.'
    case 'auth/missing-email':
    case 'auth/invalid-email':
      return 'Enter a valid email first.'
    default:
      return error?.message || 'Could not sign in.'
  }
}
