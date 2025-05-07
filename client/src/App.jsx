import React, { useState, useEffect } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, CircularProgress } from '@mui/material';
import io from 'socket.io-client';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';

const theme = createTheme();

function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      // First check if server is accessible
      fetch('http://localhost:3001/api/health')
        .then(res => {
          if (!res.ok) {
            throw new Error('Server is not responding');
          }
          return fetch('http://localhost:3001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
          });
      })
      .then(res => res.json())
      .then(data => {
          if (data.data && data.data.user) {
            setUser(data.data.user);
          // Initialize socket connection
          const newSocket = io('http://localhost:3001', {
            auth: { token }
          });
            
            newSocket.on('connect', () => {
              console.log('Socket connected successfully');
              setIsLoading(false);
            });

            newSocket.on('connect_error', (error) => {
              console.error('Socket connection error:', error);
              setIsLoading(false);
            });

          setSocket(newSocket);
        }
      })
      .catch(err => {
          console.error('Error:', err);
        localStorage.removeItem('token');
          setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetch('http://localhost:3001/api/chat/rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => setRooms(data.data.rooms || []));
    }
  }, [user]);

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    setIsLoading(true);
    // Initialize socket connection
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsLoading(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsLoading(false);
    });

    setSocket(newSocket);
  };

  const handleRegister = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    setIsLoading(true);
    // Initialize socket connection
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsLoading(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsLoading(false);
    });

    setSocket(newSocket);
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setUser(null);
    setSelectedRoom(null);
    localStorage.removeItem('token');
  };

  const handleLeaveGroup = (roomId) => {
    setRooms(prev => prev.filter(room => room._id !== roomId));
    if (selectedRoom && selectedRoom._id === roomId) {
      setSelectedRoom(null);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return showRegister ? (
      <Register
        onRegister={handleRegister}
        onSwitchToLogin={() => setShowRegister(false)}
      />
    ) : (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar
          user={user}
          onLogout={handleLogout}
          onSelectRoom={setSelectedRoom}
          selectedRoom={selectedRoom}
          socket={socket}
          rooms={rooms}
          setRooms={setRooms}
        />
        <Chat
          user={user}
          socket={socket}
          selectedRoom={selectedRoom}
          onLeaveGroup={handleLeaveGroup}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App; 