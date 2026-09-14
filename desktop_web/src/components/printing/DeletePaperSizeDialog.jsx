import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'

export default function DeletePaperSizeDialog({ open, paperSize, loading, onClose, onConfirm }) {
  const name = paperSize?.name || 'this paper size'

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete paper size</DialogTitle>
      <DialogContent>
        <DialogContentText>Delete {name}? This cannot be undone.</DialogContentText>
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
