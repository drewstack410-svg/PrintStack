const DAY_MS = 24 * 60 * 60 * 1000

function createdTime(staff) {
  if (!staff.createdAt) {
    return 0
  }

  const time = new Date(staff.createdAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

function staffName(staff) {
  return [staff.firstName, staff.middleName, staff.lastName].filter(Boolean).join(' ')
}

function matchesSearch(staff, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return [staffName(staff), staff.email].some((value) => String(value || '').toLowerCase().includes(needle))
}

function matchesAddedFilter(staff, added) {
  if (added === 'all') {
    return true
  }

  const created = createdTime(staff)
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

function compareStaffs(left, right, sort) {
  if (sort === 'oldest') {
    return createdTime(left) - createdTime(right)
  }
  if (sort === 'name-asc') {
    return staffName(left).localeCompare(staffName(right))
  }
  if (sort === 'name-desc') {
    return staffName(right).localeCompare(staffName(left))
  }

  return createdTime(right) - createdTime(left)
}

export function filterStaffs(staffs, { query = '', added = 'all', sort = 'newest' } = {}) {
  return staffs
    .filter((staff) => matchesSearch(staff, query) && matchesAddedFilter(staff, added))
    .sort((left, right) => compareStaffs(left, right, sort))
}
