// WebSocket service for realtime chat
import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
export const socket = io(WS_URL)

// Usage:
// socket.emit('send_message', {...})
// socket.on('receive_message', (msg) => {...})
