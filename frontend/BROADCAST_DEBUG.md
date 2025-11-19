# Message Broadcast Debugging Guide

## How to diagnose broadcast failures

### 1. Check Backend Terminal
When you send a message (e.g., `@agent hello`), look for:

```
[MessageRoutes] 📝 POST /messages - Creating message
[MessageRoutes]   - Message created with ID: <id>
[MessageRoutes] 📡 Broadcasting message:new to room: team:team1
[MessageRoutes]   - Clients in room: X
```

**If "Clients in room: 0"** → Frontend never joined the room!

### 2. Check Frontend Console (Browser DevTools F12)
Look for these logs in order:

#### A. Socket Connection
```
[SocketService] Connecting to http://localhost:5000...
[SocketService] ✅ Connected and ready: <socket-id>
```

#### B. Room Join
```
[SocketService] 📨 Received event: team:join
[SOCKET] ✅ <socket-id> joined team:team1 (room size: 1)
```

**If you DON'T see room size increase** → Room join failed!

#### C. Message Broadcast Receipt
```
[SocketService] 📨 Received event: message:new [MessageDTO]
[RealtimeProvider] 📨 Socket: message:new -> <message-id>
```

**If you DON'T see this** → Backend isn't broadcasting OR frontend isn't listening!

#### D. Store Update
```
[EntityStore] ✅ Added message: <message-id> to team: team1
```

**If you see this but UI doesn't update** → Component selector issue!

### 3. Manual Test Commands

Open browser console and run:

```javascript
// Check if socket is connected
window.socketTest = {
  socket: socketService.getSocket(),
  isConnected: socketService.getSocket()?.connected,
  id: socketService.getSocket()?.id
}
console.log(window.socketTest)

// Manually emit room join
socketService.getSocket()?.emit('team:join', { teamId: 'team1' })

// Check store state
console.log('Messages:', useEntityStore.getState().entities.messages)
console.log('Team Messages:', useEntityStore.getState().relationships.teamMessages)
```

### 4. Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Clients in room: 0" | Frontend never joined room | Check `socketService.joinTeam()` is called |
| Event received but no store update | Deduplication blocking | Check message.id isn't already in store |
| Store updates but UI doesn't | Selector not reactive | Use `state.relationships.teamMessages[teamId]` |
| No event received at all | Socket not connected | Check backend logs for connection |

### 5. Quick Diagnostic Script

Paste this in browser console:

```javascript
// Comprehensive diagnostic
const diagnostic = {
  socket: {
    connected: socketService.getSocket()?.connected,
    id: socketService.getSocket()?.id,
    transport: socketService.getSocket()?.io.engine.transport.name
  },
  stores: {
    currentTeam: useUIStore.getState().currentTeamId,
    messageCount: Object.keys(useEntityStore.getState().entities.messages).length,
    teamMessages: useEntityStore.getState().relationships.teamMessages
  },
  user: {
    current: useSessionStore.getState().currentUser?.id
  }
}
console.table(diagnostic)
```
