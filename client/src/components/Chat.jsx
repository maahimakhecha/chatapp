import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, IconButton, Typography, Avatar, Tooltip, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemAvatar, ListItemText, Checkbox, Badge, Chip, ListItemIcon } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

function Chat({ socket, user, selectedRoom, setSelectedRoom, onLeaveGroup }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const typingTimeout = 3000; // 3 seconds
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [generatedInviteCode, setGeneratedInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    // Fetch rooms when component mounts
    const fetchRooms = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/rooms', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setRooms(data.data.rooms || []);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    if (!socket || !selectedRoom) return;

    // Join room
    socket.emit('room:join', selectedRoom._id);

    // Fetch messages
    fetch(`http://localhost:3001/api/chat/rooms/${selectedRoom._id}/messages`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        const messages = data.data.messages || [];
        // Ensure each message has consistent ID
        const messagesWithId = messages.map(msg => ({
          ...msg,
          id: msg._id || msg.id
        }));
        console.log('Fetched messages:', messagesWithId);
        setMessages(messagesWithId);
      });

    // Socket event listeners
    const handleNewMessage = msg => {
      if (msg.room === selectedRoom._id) {
        console.log('New message received:', msg);
        const newMsg = {
          ...msg,
          id: msg._id || msg.id
        };
        setMessages(prev => {
          // Remove any temporary message with the same content
          const filteredPrev = prev.filter(m => !m.id.startsWith('temp-'));
          return [...filteredPrev, newMsg];
        });
      }
    };

    const handleMessageStatus = ({ messageId, status, readBy }) => {
      console.log('Message status update:', { messageId, status, readBy });
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId || msg._id === messageId) {
          const newStatus = readBy && readBy.length > 0 ? 'read' : status;
          console.log(`Updating message ${messageId} status to ${newStatus}`, { readBy });
          return {
            ...msg,
            status: newStatus,
            readBy: readBy || msg.readBy || []
          };
        }
        return msg;
      }));
    };

    const handleMessageRead = ({ messageId, readBy }) => {
      console.log('Message read:', { messageId, readBy });
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId || msg._id === messageId) {
          console.log(`Marking message ${messageId} as read`, { readBy });
          return {
            ...msg,
            status: 'read',
            readBy: readBy || [...(msg.readBy || []), user.id]
          };
        }
        return msg;
      }));
    };

    const handleTypingStart = ({ userId, userName }) => {
      if (userId !== (user.id || user._id)) {
        setTypingUsers(prev => ({ ...prev, [userId]: userName }));
        // Clear typing status after timeout
        setTimeout(() => {
          setTypingUsers(prev => {
            const newState = { ...prev };
            delete newState[userId];
            return newState;
          });
        }, typingTimeout);
      }
    };

    const handleTypingStop = ({ userId }) => {
      setTypingUsers(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    };

    const handleMessageUpdate = updatedMessage => {
      setMessages(prev => prev.map(msg => 
        msg.id === updatedMessage._id ? {
          ...msg,
          reactions: updatedMessage.reactions,
          readBy: updatedMessage.readBy
        } : msg
      ));
    };

    const handleUserStatus = ({ userId, status }) => {
      console.log('User status update:', { userId, status });
      setUserStatuses(prev => ({
        ...prev,
        [userId]: status
      }));

      // Update message status to delivered when recipient is offline or in another chat
      if (status === 'offline' || status === 'away') {
        setMessages(prev => prev.map(msg => {
          if (msg.sender.id === user.id && msg.status === 'sent') {
            return { ...msg, status: 'delivered' };
          }
          return msg;
        }));
      }
    };

    const handleUsersStatus = (statuses) => {
      console.log('All users status update:', statuses);
      const newStatuses = {};
      statuses.forEach(({ userId, status }) => {
        newStatuses[userId] = status;
      });
      setUserStatuses(prev => ({
        ...prev,
        ...newStatuses
      }));
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:status', handleMessageStatus);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:update', handleMessageUpdate);
    socket.on('user:status', handleUserStatus);
    socket.on('users:status', handleUsersStatus);

    // Request initial user statuses
    socket.emit('users:status');

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:status', handleMessageStatus);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:update', handleMessageUpdate);
      socket.off('user:status', handleUserStatus);
      socket.off('users:status', handleUsersStatus);
    };
  }, [socket, selectedRoom, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedRoom) return;
    // Optimistically add the message
    const tempId = `temp-${Date.now()}`; // Temporary ID with prefix
    const newMessage = {
      id: tempId,
      content: message,
      sender: { id: user.id, name: user.name },
      createdAt: new Date().toISOString(),
      reactions: {},
      status: 'sent'  // Add initial status
    };
    setMessages(prev => [...prev, newMessage]);
    socket.emit('message:send', {
      content: message,
      roomId: selectedRoom._id
    });
    setMessage('');
    // Stop typing indicator
    socket.emit('typing:stop', { roomId: selectedRoom._id });
    setIsTyping(false);
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing:start', { 
        roomId: selectedRoom._id,
        userName: user.name
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing:stop', { roomId: selectedRoom._id });
    }, typingTimeout);
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReaction = (messageId, reaction) => {
    socket.emit('message:react', {
      messageId,
      reaction
    });
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLeaveGroup = async () => {
    console.log('Attempting to leave group:', selectedRoom._id);
    try {
      const res = await fetch('http://localhost:3001/api/rooms/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ roomId: selectedRoom._id })
      });
      
      const data = await res.json();
      console.log('Leave group response:', data);
      
      if (res.ok) {
        console.log('Successfully left group');
        // Call the onLeaveGroup callback to update the parent component
        onLeaveGroup(selectedRoom._id);
        // Close the menu
        handleMenuClose();
      } else {
        console.error('Error leaving group:', data.message);
      }
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  };

  const openRemoveDialog = () => {
    setSelectedMembers([]);
    setShowRemoveDialog(true);
    handleMenuClose();
  };
  const closeRemoveDialog = () => setShowRemoveDialog(false);

  const handleToggleMember = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleRemoveMembers = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/rooms/remove-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ roomId: selectedRoom._id, memberIds: selectedMembers })
      });
      if (res.ok) {
        // Optionally, refetch room info or update UI
        closeRemoveDialog();
      }
    } catch (err) {
      // Optionally show error
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
        throw new Error(data.message || 'Failed to join group');
      }

      // Close dialog and refresh the page to show the new group
      setShowJoinDialog(false);
      setInviteCode('');
      setJoinError('');
      window.location.reload();
    } catch (error) {
      console.error('Error joining group:', error);
      setJoinError(error.message);
    }
  };

  const handleSearchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:3001/api/users/search?query=${query}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      setSearchResults(data.data.users || []);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedUsers.length) {
      console.log('No users selected to add');
      return;
    }
    
    console.log('Attempting to add members:', selectedUsers.map(u => u._id));
    try {
      const res = await fetch(`http://localhost:3001/api/rooms/add-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          roomId: selectedRoom._id,
          memberIds: selectedUsers.map(u => u._id)
        })
      });

      const data = await res.json();
      console.log('Add members response:', data);

      if (res.ok) {
        console.log('Successfully added members');
        // Close the dialog and clear selected users
        setShowAddMembersDialog(false);
        setSelectedUsers([]);
        setSearchResults([]);
        // Refresh the page to show updated members
        window.location.reload();
      } else {
        console.error('Error adding members:', data.message);
      }
    } catch (err) {
      console.error('Error adding members:', err);
    }
  };

  const generateInviteCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setGeneratedInviteCode(code);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(generatedInviteCode);
  };

  const onSelectRoom = (room) => {
    // Emit leave event for current room if exists
    if (selectedRoom) {
      socket.emit('room:leave', selectedRoom._id);
    }
    // Emit join event for new room
    socket.emit('room:join', room._id);
    // Update selected room
    setSelectedRoom(room);
  };

  // Debug log for selectedRoom
  console.log('selectedRoom', selectedRoom);

  if (!selectedRoom) {
    return <div style={{ padding: 32 }}>Select a room to start chatting.</div>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', flex: 1 }}>
      {/* Chat header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">{selectedRoom.name}</Typography>
          {/* Robust group member display with avatars and online/offline status */}
          {!selectedRoom.isDirect && Array.isArray(selectedRoom.members) && selectedRoom.members.length > 0 && (
            <>
              {/* Avatars with status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {selectedRoom.members
                  .filter(member => member && (member._id || member.id))
                  .map((member) => {
                    const key = `member-tooltip-${member._id || member.id || Math.random()}`;
                    return (
                      <Tooltip 
                        key={key}
                        title={`${member.name || 'Unknown User'} (${userStatuses[member._id || member.id] || 'offline'})`}
                      >
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          variant="dot"
                          color={userStatuses[member._id || member.id] === 'online' ? 'success' : 'default'}
                          sx={{
                            '& .MuiBadge-badge': {
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                            },
                          }}
                        >
                          <Avatar sx={{ width: 24, height: 24, fontSize: 14 }}>
                            {member.name ? member.name[0] : '?'}
                          </Avatar>
                        </Badge>
                      </Tooltip>
                    );
                  })}
              </Box>
              {/* Names and status as text */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 0.5 }}>
                {selectedRoom.members
                  .filter(member => member && (member._id || member.id))
                  .map((member) => {
                    const key = `member-name-${member._id || member.id || Math.random()}`;
                    return (
                      <Typography
                        key={key}
                        variant="caption"
                        sx={{ color: userStatuses[member._id || member.id] === 'online' ? 'green' : 'gray' }}
                      >
                        {member.name || 'Unknown User'} ({userStatuses[member._id || member.id] || 'offline'})
                      </Typography>
                    );
                  })}
              </Box>
            </>
          )}
          {/* Fallback if no group members */}
          {!selectedRoom.isDirect && (!Array.isArray(selectedRoom.members) || selectedRoom.members.length === 0) && (
            <Typography variant="caption" color="text.secondary">
              No group members found.
            </Typography>
          )}
        </Box>
        {/* Group management menu */}
        {!selectedRoom.isDirect && (
          <IconButton onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        )}
        <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={handleMenuClose}>
          <MenuItem key="join-group" onClick={() => {
            setShowJoinDialog(true);
            handleMenuClose();
          }}>Join Group</MenuItem>
          {!selectedRoom.isDirect && (
            <>
              <MenuItem key="add-members" onClick={() => {
                setShowAddMembersDialog(true);
                handleMenuClose();
              }}>
                <ListItemIcon>
                  <PersonAddIcon fontSize="small" />
                </ListItemIcon>
                Add Members
              </MenuItem>
              <MenuItem key="generate-invite" onClick={() => {
                generateInviteCode();
                handleMenuClose();
              }}>
                <ListItemIcon>
                  <ContentCopyIcon fontSize="small" />
                </ListItemIcon>
                Generate Invite Code
              </MenuItem>
            </>
          )}
          <MenuItem key="leave-group" onClick={handleLeaveGroup}>Leave Group</MenuItem>
          {/* Only show remove member and edit name for group creator */}
          {selectedRoom.creator === (user.id || user._id) && (
            <>
              <MenuItem key="edit-name" onClick={() => { /* TODO: Implement edit group name */ handleMenuClose(); }}>Edit Group Name</MenuItem>
              <MenuItem key="remove-member" onClick={openRemoveDialog}>Remove Member</MenuItem>
            </>
          )}
        </Menu>
      </Box>

      {/* Messages area */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, minHeight: 0 }}>
        {messages.map((msg) => {
          const messageId = msg._id || msg.id;
          const senderId = msg.sender.id || msg.sender._id;
          const currentUserId = user.id || user._id;
          const isSentByCurrentUser = senderId === currentUserId;
          const senderStatus = userStatuses[senderId] || 'offline';
          
          return (
            <Box
              key={`message-${messageId}`}
              sx={{
                display: 'flex',
                justifyContent: isSentByCurrentUser ? 'flex-end' : 'flex-start',
                mb: 2
              }}
            >
              <Box
                sx={{
                  maxWidth: '70%',
                  bgcolor: isSentByCurrentUser ? 'primary.main' : 'grey.100',
                  color: isSentByCurrentUser ? 'white' : 'text.primary',
                  p: 2,
                  borderRadius: 2
                }}
              >
                {!isSentByCurrentUser && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2">
                      {msg.sender.name}
                    </Typography>
                    <Tooltip title={senderStatus}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        variant="dot"
                        color={senderStatus === 'online' ? 'success' : 'default'}
                        sx={{
                          '& .MuiBadge-badge': {
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                          },
                        }}
                      >
                        <Box sx={{ width: 8, height: 8 }} />
                      </Badge>
                    </Tooltip>
                  </Box>
                )}
                <Typography>{msg.content}</Typography>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mt: 1 
                }}>
                  <Typography variant="caption" color={isSentByCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
                    {format(new Date(msg.createdAt), 'h:mm a')}
                  </Typography>
                  {isSentByCurrentUser && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                      {msg.status === 'sent' && (
                        <Typography variant="caption" color="rgba(255,255,255,0.7)">✓</Typography>
                      )}
                      {msg.status === 'delivered' && (
                        <Typography variant="caption" color="rgba(255,255,255,0.7)">✓✓</Typography>
                      )}
                      {msg.status === 'read' && (
                        <Typography variant="caption" color="rgba(255,255,255,0.7)" sx={{ fontWeight: 'bold' }}>✓✓</Typography>
                      )}
                    </Box>
                  )}
                </Box>
                {Object.entries(msg.reactions || {}).length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                    {Object.entries(msg.reactions).map(([reaction, count], index) => (
                      <Tooltip 
                        key={`reaction-${messageId}-${reaction}-${index}`} 
                        title={`${count} users reacted with ${reaction}`}
                      >
                        <Box
                          sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            px: 0.5,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleReaction(messageId, reaction)}
                        >
                          {reaction} {count}
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
        {Object.keys(typingUsers).length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            ml: 2, 
            mt: 1,
            color: 'text.secondary',
            fontStyle: 'italic'
          }}>
            <Typography variant="caption">
              {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: 0.5,
              animation: 'typing 1s infinite'
            }}>
              {[0, 1, 2].map((index) => (
                <Box 
                  key={`typing-dot-${index}`}
                  sx={{ 
                    width: 4, 
                    height: 4, 
                    borderRadius: '50%', 
                    bgcolor: 'text.secondary',
                    animation: `typing 1s infinite ${index * 0.2}s`
                  }} 
                />
              ))}
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', position: 'relative' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            <EmojiEmotionsIcon />
          </IconButton>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <IconButton color="primary" onClick={handleSend}>
            <SendIcon />
          </IconButton>
        </Box>
        {showEmojiPicker && (
          <Box sx={{ position: 'absolute', bottom: '100%', right: 0 }}>
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </Box>
        )}
      </Box>

      {/* Dialogs */}
      {/* Remove Member Dialog */}
      <Dialog open={showRemoveDialog} onClose={closeRemoveDialog}>
        <DialogTitle>Remove Members</DialogTitle>
        <DialogContent>
          <List>
            {selectedRoom.members
              .filter(m => (m._id || m.id) !== (user.id || user._id))
              .map(member => (
                <ListItem 
                  key={`member-${member._id || member.id}`} 
                  button 
                  onClick={() => handleToggleMember(member._id || member.id)}
                >
                  <ListItemAvatar>
                    <Avatar>{member.name ? member.name[0] : '?'}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={member.name || 'Unknown User'} secondary={member.email || ''} />
                  <Checkbox checked={selectedMembers.includes(member._id || member.id)} />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRemoveDialog}>Cancel</Button>
          <Button onClick={handleRemoveMembers} variant="contained" disabled={selectedMembers.length === 0}>Remove</Button>
        </DialogActions>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={showAddMembersDialog} onClose={() => setShowAddMembersDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Members</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Search Users"
            fullWidth
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearchUsers(e.target.value);
            }}
            placeholder="Search by name or email"
          />
          {selectedUsers.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedUsers.map((user) => (
                <Chip
                  key={user._id}
                  label={user.name}
                  onDelete={() => setSelectedUsers(prev => prev.filter(u => u._id !== user._id))}
                />
              ))}
            </Box>
          )}
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
          <Button onClick={() => setShowAddMembersDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddMembers}
            variant="contained"
            disabled={selectedUsers.length === 0}
          >
            Add Members
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={!!generatedInviteCode} onClose={() => setGeneratedInviteCode('')}>
        <DialogTitle>Group Invite Code</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              {generatedInviteCode}
            </Typography>
            <IconButton onClick={copyInviteCode} size="small">
              <ContentCopyIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Share this code with people you want to invite to the group.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeneratedInviteCode('')}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Chat; 