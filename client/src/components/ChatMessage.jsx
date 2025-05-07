import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Tooltip,
  Badge,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export const ChatMessage = ({ message, sender }) => {
  const { currentUser } = useAuth();
  const isOwnMessage = message.sender === currentUser?._id;

  useEffect(() => {
    console.log('ChatMessage rendered with sender:', sender);
  }, [sender]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: isOwnMessage ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          maxWidth: '70%',
        }}
      >
        <Box sx={{ mx: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Tooltip title={`${sender?.name} (${sender?.status || 'offline'})`}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              color={(sender?.status === 'online') ? 'success' : 'default'}
              sx={{
                '& .MuiBadge-badge': {
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                },
              }}
            >
              <Avatar
                src={sender?.avatar}
                alt={sender?.name}
                sx={{ width: 40, height: 40 }}
              >
                {sender?.name?.charAt(0)}
              </Avatar>
            </Badge>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {sender?.name}
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: isOwnMessage ? 'primary.main' : 'grey.100',
            color: isOwnMessage ? 'white' : 'text.primary',
            p: 2,
            borderRadius: 2,
            position: 'relative',
          }}
        >
          <Typography variant="body1">{message.content}</Typography>
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 8,
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'text.secondary',
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}; 