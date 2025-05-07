import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';

export const InviteCodeDialog = ({ open, onClose, inviteCode, onJoinGroup, mode = 'copy' }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setShowSnackbar(true);
    }
  };

  const handleJoinGroup = async () => {
    if (!code.trim()) {
      setError('Please enter an invite code');
      return;
    }
    try {
      await onJoinGroup(code);
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to join group');
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {mode === 'copy' ? 'Copy Invite Code' : 'Join Group'}
        </DialogTitle>
        <DialogContent>
          {mode === 'copy' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Typography variant="body1" sx={{ flexGrow: 1 }}>
                {inviteCode}
              </Typography>
              <IconButton onClick={handleCopyCode} color="primary">
                <ContentCopyIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <TextField
                autoFocus
                fullWidth
                label="Enter Invite Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={!!error}
                helperText={error}
                placeholder="Enter the group invite code"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          {mode === 'join' && (
            <Button onClick={handleJoinGroup} variant="contained" color="primary">
              Join Group
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSnackbar(false)} severity="success">
          Invite code copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
}; 