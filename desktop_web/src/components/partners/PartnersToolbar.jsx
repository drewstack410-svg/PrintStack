import SearchIcon from '@mui/icons-material/Search'
import { InputAdornment, MenuItem, Stack, TextField } from '@mui/material'

export default function PartnersToolbar({
  query,
  added,
  sort,
  onQueryChange,
  onAddedChange,
  onSortChange,
  searchPlaceholder = 'Search by company or email',
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
      <TextField
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={searchPlaceholder}
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        select
        size="small"
        label="Added"
        value={added}
        onChange={(event) => onAddedChange(event.target.value)}
        sx={{ minWidth: { md: 140 } }}
      >
        <MenuItem value="all">All time</MenuItem>
        <MenuItem value="7d">Last 7 days</MenuItem>
        <MenuItem value="30d">Last 30 days</MenuItem>
        <MenuItem value="year">This year</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="Sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value)}
        sx={{ minWidth: { md: 140 } }}
      >
        <MenuItem value="newest">Newest first</MenuItem>
        <MenuItem value="oldest">Oldest first</MenuItem>
        <MenuItem value="name-asc">Name A–Z</MenuItem>
        <MenuItem value="name-desc">Name Z–A</MenuItem>
      </TextField>
    </Stack>
  )
}
