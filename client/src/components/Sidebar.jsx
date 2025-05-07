import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import { format } from 'date-fns';

function Sidebar({ user, onLogout, onSelectRoom, selectedRoom, socket, rooms, setRooms }) {
  const [users, setUsers] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    // Fetch users
    fetch('http://localhost:3001/api/users/search?query=', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => setUsers(data.data.users || []));

    // Socket event listeners
    if (socket) {
      const handleUserStatus = ({ userId, status }) => {
        setUsers(prev => prev.map(u => 
          u._id === userId ? { ...u, status } : u
        ));
      };

      const handleRoomUpdate = (updatedRoom) => {
        setRooms(prev => prev.map(room => 
          room._id === updatedRoom._id ? updatedRoom : room
        ));
      };

      socket.on('user:status', handleUserStatus);
      socket.on('room:updated', handleRoomUpdate);

      return () => {
        socket.off('user:status', handleUserStatus);
        socket.off('room:updated', handleRoomUpdate);
      };
    }
  }, [socket]);

  const handleCreateRoom = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newRoomName,
          memberIds: selectedUsers.map(u => u._id)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRooms(prev => [...prev, data.data.room]);
        setShowCreateRoom(false);
        setNewRoomName('');
        setSelectedUsers([]);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedRoom) return;
    try {
      const res = await fetch(`http://localhost:3001/api/chat/rooms/${selectedRoom._id}/add-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          memberIds: selectedUsers.map(u => u._id)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowAddMembers(false);
        setSelectedUsers([]);
      }
    } catch (error) {
      console.error('Error adding members:', error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const res = await fetch(`http://localhost:3001/api/users/search?query=${query}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await res.json();
        setSearchResults(data.data.users || []);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleCreateDirectMessage = async (userId) => {
    try {
      const res = await fetch('http://localhost:3001/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          isDirect: true,
          memberIds: [userId]
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRooms(prev => [...prev, data.data.room]);
        onSelectRoom(data.data.room);
      }
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleJoinGroup = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ inviteCode })
      });
      const data = await response.json();
      if (!response.ok) {
        setJoinError(data.message || 'Failed to join group');
        return;
      }
      // Success: close dialog, clear code, refresh rooms
      setShowJoinGroup(false);
      setInviteCode('');
      setJoinError('');
      // Refresh rooms
      fetch('http://localhost:3001/api/chat/rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => setRooms(data.data.rooms || []));
    } catch (error) {
      setJoinError('Failed to join group');
    }
  };

  const handleLeaveGroupSidebar = (roomId) => {
    setRooms(prevRooms => prevRooms.filter(room => room._id !== roomId));
    if (selectedRoom && selectedRoom._id === roomId) {
      onSelectRoom(null);
    }
  };

  return (
    <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      {/* User profile */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar>{user.name[0]}</Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1">{user.name}</Typography>
          <Typography variant="caption" color="textSecondary">
            {user.email}
          </Typography>
        </Box>
        <Button onClick={onLogout} size="small">
          Logout
        </Button>
      </Box>

      {/* Join Group Button */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<GroupIcon />}
          onClick={() => setShowJoinGroup(true)}
        >
          Join Group
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
        />
        {searchResults.length > 0 && (
          <List sx={{ mt: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
            {searchResults.map((user) => (
              <ListItem
                key={user._id}
                button
                onClick={() => handleCreateDirectMessage(user._id)}
              >
                <ListItemAvatar>
                  <Avatar>{user.name[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={user.name}
                  secondary={user.email}
                />
                <Chip
                  size="small"
                  label={user.status}
                  color={getStatusColor(user.status)}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Rooms */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Chats</Typography>
          <IconButton onClick={() => setShowCreateRoom(true)}>
            <AddIcon />
          </IconButton>
        </Box>
        <List>
          {rooms.map((room) => (
            <ListItem
              key={room._id}
              button
              selected={selectedRoom?._id === room._id}
              onClick={() => onSelectRoom(room)}
            >
              <ListItemAvatar>
                <Avatar>
                  {room.isDirect ? <PersonIcon /> : <GroupIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={room.name}
                secondary={room.lastMessage ? room.lastMessage.content : 'No messages yet'}
              />
              {room.isDirect && room.members?.[0]?.status && (
                <Chip
                  size="small"
                  label={room.members[0].status}
                  color={getStatusColor(room.members[0].status)}
                />
              )}
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoom} onClose={() => setShowCreateRoom(false)}>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Add Members
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedUsers.map((user) => (
              <Chip
                key={user._id}
                label={user.name}
                onDelete={() => setSelectedUsers(prev => prev.filter(u => u._id !== user._id))}
              />
            ))}
          </Box>
          <TextField
            margin="dense"
            label="Search Users"
            fullWidth
            onChange={(e) => handleSearch(e.target.value)}
          />
          <List>
            {searchResults
              .filter(u => !selectedUsers.find(su => su._id === u._id))
              .map((user) => (
                <ListItem
                  key={user._id}
                  button
                  onClick={() => setSelectedUsers(prev => [...prev, user])}
                >
                  <ListItemAvatar>
                    <Avatar>{user.name[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={user.email}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateRoom(false)}>Cancel</Button>
          <Button onClick={handleCreateRoom} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={showAddMembers} onClose={() => setShowAddMembers(false)}>
        <DialogTitle>Add Members</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {selectedUsers.map((user) => (
              <Chip
                key={user._id}
                label={user.name}
                onDelete={() => setSelectedUsers(prev => prev.filter(u => u._id !== user._id))}
              />
            ))}
          </Box>
          <TextField
            margin="dense"
            label="Search Users"
            fullWidth
            onChange={(e) => handleSearch(e.target.value)}
          />
          <List>
            {searchResults
              .filter(u => !selectedUsers.find(su => su._id === u._id))
              .map((user) => (
                <ListItem
                  key={user._id}
                  button
                  onClick={() => setSelectedUsers(prev => [...prev, user])}
                >
                  <ListItemAvatar>
                    <Avatar>{user.name[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={user.email}
                  />
                </ListItem>
      ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMembers(false)}>Cancel</Button>
          <Button onClick={handleAddMembers} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoinGroup} onClose={() => { setShowJoinGroup(false); setInviteCode(''); setJoinError(''); }}>
        <DialogTitle>Join Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Enter Invite Code"
            type="text"
            fullWidth
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            error={!!joinError}
            helperText={joinError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowJoinGroup(false); setInviteCode(''); setJoinError(''); }}>Cancel</Button>
          <Button variant="contained" disabled={!inviteCode.trim()} onClick={handleJoinGroup}>Join</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Sidebar; 