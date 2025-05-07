import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  AvatarGroup,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ExitToApp as ExitToAppIcon,
  PersonRemove as PersonRemoveIcon,
  GroupAdd as GroupAddIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { InviteCodeDialog } from './InviteCodeDialog';
import { RemoveMemberDialog } from './RemoveMemberDialog';

export const ChatHeader = ({ onLeaveGroup, onRemoveMember }) => {
  const { currentUser } = useAuth();
  const { selectedRoom, setSelectedRoom } = useChat();
  const [anchorEl, setAnchorEl] = useState(null);
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteDialogMode, setInviteDialogMode] = useState('join');

  useEffect(() => {
    console.log('ChatHeader mounted');
    console.log('Current user:', currentUser);
    console.log('Selected room:', selectedRoom);
    if (selectedRoom?.members) {
      console.log('Room members with status:', selectedRoom.members.map(m => ({
        name: m.name,
        status: m.status,
        _id: m._id
      })));
    }
  }, [selectedRoom, currentUser]);

  const isGroupChat = selectedRoom?.type === 'group';
  const isGroupCreator = selectedRoom?.createdBy === currentUser?._id;

  const handleMenuClick = (event) => {
    console.log('Menu clicked');
    console.log('Event target:', event.currentTarget);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    console.log('Menu closed');
    setAnchorEl(null);
  };

  const handleShowInviteDialog = (mode) => {
    console.log('Showing invite dialog in mode:', mode);
    setInviteDialogMode(mode);
    setShowInviteDialog(true);
    handleMenuClose();
  };

  const handleJoinGroup = async (code) => {
    try {
      console.log('Attempting to join group with code:', code);
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ inviteCode: code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join group');
      }

      const room = await response.json();
      console.log('Successfully joined room:', room);
      setSelectedRoom(room);
      window.location.reload();
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  };

  const renderMemberAvatar = (member) => {
    console.log('Rendering member avatar:', member);
    return (
      <Tooltip 
        title={`${member.name} (${member.status || 'offline'})`}
        key={member._id}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          color={(member.status === 'online') ? 'success' : 'default'}
          sx={{
            '& .MuiBadge-badge': {
              width: 10,
              height: 10,
              borderRadius: '50%',
            },
          }}
        >
          <Avatar
            alt={member.name}
            src={member.avatar}
            sx={{ width: 32, height: 32 }}
          >
            {member.name.charAt(0)}
          </Avatar>
        </Badge>
      </Tooltip>
    );
  };

  console.log('ChatHeader rendering with:', {
    selectedRoom,
    isGroupChat,
    isGroupCreator,
    anchorEl,
    showInviteDialog,
    inviteDialogMode
  });

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {selectedRoom?.name || 'Chat'}
            </Typography>
            <Box sx={{ ml: 2, p: 1, bgcolor: '#eee', color: '#333', borderRadius: 1, fontSize: 12 }}>
              <div>selectedRoom: {selectedRoom ? 'yes' : 'no'}</div>
              <div>selectedRoom.type: {selectedRoom?.type || 'none'}</div>
              <div>isGroupCreator: {isGroupCreator ? 'yes' : 'no'}</div>
              {selectedRoom?.members && (
                <div>Members: {selectedRoom.members.length}</div>
              )}
            </Box>
            {isGroupChat && selectedRoom?.members && (
              <AvatarGroup
                max={4}
                sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
              >
                {selectedRoom.members.map(renderMemberAvatar)}
              </AvatarGroup>
            )}
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            aria-label="menu"
            onClick={handleMenuClick}
            sx={{ zIndex: 1000 }}
          >
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        sx={{ zIndex: 1001 }}
      >
        <MenuItem 
          onClick={() => {
            console.log("Join Group clicked from menu");
            handleShowInviteDialog('join');
          }}
        >
          <ListItemIcon>
            <GroupAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Join Group</ListItemText>
        </MenuItem>

        {isGroupChat && (
          <MenuItem onClick={() => handleShowInviteDialog('copy')}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy Invite Code</ListItemText>
          </MenuItem>
        )}
        {isGroupChat && isGroupCreator && (
          <MenuItem onClick={() => setShowRemoveMemberDialog(true)}>
            <ListItemIcon>
              <PersonRemoveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Remove Member</ListItemText>
          </MenuItem>
        )}
        {isGroupChat && (
          <MenuItem onClick={onLeaveGroup}>
            <ListItemIcon>
              <ExitToAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Leave Group</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <RemoveMemberDialog
        open={showRemoveMemberDialog}
        onClose={() => setShowRemoveMemberDialog(false)}
        onRemoveMember={onRemoveMember}
        members={selectedRoom?.members || []}
      />

      <InviteCodeDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        inviteCode={selectedRoom?.inviteCode}
        onJoinGroup={handleJoinGroup}
        mode={inviteDialogMode}
      />
    </>
  );
}; 