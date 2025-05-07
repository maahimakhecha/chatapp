# Real-Time Chat Application

A modern, scalable real-time chat application built with React, Node.js, and WebSocket technology.

## Features

- Real-time one-on-one messaging
- Group chat support
- User presence indicators
- Typing indicators
- Emoji reactions
- Message status (delivered/read)
- Chat history persistence
- Multi-device login sync

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Real-time**: WebSocket (Socket.IO)
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Styling**: Tailwind CSS

## Project Structure

```
chatapp/
├── client/             # React frontend
├── server/             # Node.js backend
├── shared/             # Shared types and utilities
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Server
   cp server/.env.example server/.env
   
   # Client
   cp client/.env.example client/.env
   ```

4. Start the development servers:
   ```bash
   # Start server
   cd server
   npm run dev

   # Start client
   cd ../client
   npm run dev
   ```

## Architecture

The application follows a microservices architecture with the following components:

- WebSocket server for real-time communication
- REST API for CRUD operations
- MongoDB database for data persistence
- Redis for caching and pub/sub (optional)

## Scalability

The application is designed to handle 10,000+ concurrent users through:

- Horizontal scaling of WebSocket servers
- Database sharding
- Caching layer
- Load balancing
- Message queue for handling high load

## License

MIT 