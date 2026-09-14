export const SUPERADMIN_ROLE = 'superadmin'
export const ADMIN_ROLE = 'admin'
export const PARTNER_ROLE = 'partner'
export const STAFF_ROLE = 'staff'
export const CUSTOMER_ROLE = 'customer'

export function mapUserDoc(uid, data = {}, fallbackEmail = '') {
  const rawRole = data.role || CUSTOMER_ROLE
  const role = rawRole === 'user' ? CUSTOMER_ROLE : rawRole

  return {
    uid,
    email: data.email || fallbackEmail,
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    role,
    partnerId: data.partnerId || '',
    ownerUid: data.ownerUid || '',
    companyName: data.companyName || '',
    logoUrl: data.logoUrl || '',
    logoPath: data.logoPath || '',
    staffUids: Array.isArray(data.staffUids) ? data.staffUids : [],
    superadmin: role === SUPERADMIN_ROLE,
    admin: role === ADMIN_ROLE,
    staff: role === STAFF_ROLE,
    customer: role === CUSTOMER_ROLE,
  }
}

export function displayName(profile) {
  if (!profile) {
    return ''
  }

  return [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(' ')
}
