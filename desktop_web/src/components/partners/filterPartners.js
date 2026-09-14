const DAY_MS = 24 * 60 * 60 * 1000

function createdTime(partner) {
  if (!partner.createdAt) {
    return 0
  }

  const time = new Date(partner.createdAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

function matchesSearch(partner, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return [partner.companyName, partner.email].some((value) => String(value || '').toLowerCase().includes(needle))
}

function matchesAddedFilter(partner, added) {
  if (added === 'all') {
    return true
  }

  const created = createdTime(partner)
  if (!created) {
    return false
  }

  const now = Date.now()
  if (added === '7d') {
    return now - created <= 7 * DAY_MS
  }
  if (added === '30d') {
    return now - created <= 30 * DAY_MS
  }
  if (added === 'year') {
    return new Date(created).getFullYear() === new Date().getFullYear()
  }

  return true
}

function comparePartners(left, right, sort) {
  if (sort === 'oldest') {
    return createdTime(left) - createdTime(right)
  }
  if (sort === 'name-asc') {
    return String(left.companyName || '').localeCompare(String(right.companyName || ''))
  }
  if (sort === 'name-desc') {
    return String(right.companyName || '').localeCompare(String(left.companyName || ''))
  }

  return createdTime(right) - createdTime(left)
}

export function filterPartners(partners, { query = '', added = 'all', sort = 'newest' } = {}) {
  return partners
    .filter((partner) => matchesSearch(partner, query) && matchesAddedFilter(partner, added))
    .sort((left, right) => comparePartners(left, right, sort))
}
