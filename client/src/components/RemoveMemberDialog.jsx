import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
} from '@mui/material';

export const RemoveMemberDialog = ({ open, onClose, onRemoveMember, members }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
  };

  const handleRemoveMember = () => {
    if (selectedMember) {
      onRemoveMember(selectedMember._id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Remove Member</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a member to remove from the group
        </Typography>
        <List>
          {members.map((member) => (
            <ListItem
              key={member._id}
              button
              selected={selectedMember?._id === member._id}
              onClick={() => handleMemberSelect(member)}
            >
              <ListItemAvatar>
                <Avatar src={member.avatar} alt={member.name}>
                  {member.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.name}
                secondary={member.email}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleRemoveMember}
          color="error"
          disabled={!selectedMember}
        >
          Remove Member
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 