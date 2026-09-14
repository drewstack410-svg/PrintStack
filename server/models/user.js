const SUPERADMIN_ROLE = 'superadmin'
const ADMIN_ROLE = 'admin'
const PARTNER_ROLE = 'partner'
const STAFF_ROLE = 'staff'
const CUSTOMER_ROLE = 'customer'

function mapUserDoc(uid, data = {}, fallbackEmail = '') {
  const rawRole = data.role || CUSTOMER_ROLE
  // Legacy mobile docs used "user"; treat them as customers.
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

function displayName(profile) {
  if (!profile) {
    return ''
  }

  return [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(' ')
}

module.exports = {
  SUPERADMIN_ROLE,
  ADMIN_ROLE,
  PARTNER_ROLE,
  STAFF_ROLE,
  CUSTOMER_ROLE,
  mapUserDoc,
  displayName,
}
