import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { displayName } from '../../users'

export default function DeleteStaffDialog({ open, staff, loading, onClose, onConfirm }) {
  const name = staff ? displayName(staff) || staff.email : 'this staff member'

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete staff</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Delete {name}? This removes their login and cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button size="small" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button size="small" color="error" variant="contained" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
