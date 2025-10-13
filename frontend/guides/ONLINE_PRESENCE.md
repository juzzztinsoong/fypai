# Online Presence Feature

## Overview
Added real-time online presence indicators throughout the chat interface to show which team members are currently active.

## New Components & Stores

### 1. **PresenceStore** (`frontend/src/stores/presenceStore.ts`)
- **Purpose**: Track online/offline status of users
- **State**: 
  - `onlineUsers: Set<string>` - Set of user IDs currently online
- **Methods**:
  - `setUserOnline(userId)` - Mark user as online
  - `setUserOffline(userId)` - Mark user as offline
  - `isUserOnline(userId)` - Check if user is online
  - `getOnlineCount()` - Get total online users
  - `setMultipleUsersOnline(userIds[])` - Set multiple users online at once
- **Mock Data**: Initially simulates users user1, user2, user4, user5, and agent as online

### 2. **ChatHeader Component** (`frontend/src/components/Chat/ChatHeader.tsx`)
- **Purpose**: Display team information and online status at top of chat window
- **Features**:
  - Shows team name prominently
  - Displays total member count with user icon
  - Shows online member count with animated green indicator
  - Displays avatars of up to 5 online members with green status dots
  - Shows "+X" badge if more than 5 members are online

## Updated Components

### 3. **ChatWindow** (`frontend/src/components/Chat/ChatWindow.tsx`)
- Added `<ChatHeader />` at the top of the chat window
- Header appears above the message list

### 4. **MessageList** (`frontend/src/components/Chat/MessageList.tsx`)
- Added online indicators (green dots) to all message avatars:
  - **Your messages**: Green dot on your avatar (right side)
  - **Agent messages**: Green dot on AI assistant icon (center)
  - **Other users**: Green dot on their avatar initials (left side)
- Replaced missing avatars with colored initials
- Online status updates in real-time based on presence store

## Visual Design

### Online Indicators
- **Green pulsing dot** in header: Animated to draw attention to online count
- **Small green dots** on avatars: 2.5px circle with white ring border
- **Avatar initials**: Colored circles with first letter when no avatar image

### Header Layout
```
[Team Name]
[👥 X members] [🟢 Y online] [Avatar] [Avatar] [Avatar] [+Z]
```

### Color Scheme
- Online indicator: `bg-green-500` with pulsing animation
- Header text: Gray for labels, green for online count
- Avatars: Gradient from blue to purple for visual appeal

## Future Enhancements

### Backend Integration (TODO)
1. **WebSocket Events**:
   ```javascript
   socket.on('presence:update', ({ userId, status }) => {
     if (status === 'online') setUserOnline(userId);
     else setUserOffline(userId);
   });
   ```

2. **Typing Indicators**:
   - Add `typingUsers: Set<string>` to presence store
   - Show "X is typing..." below chat header

3. **Last Seen Timestamps**:
   - Track `lastSeen: Record<userId, timestamp>`
   - Display "Last seen 5 minutes ago" for offline users

4. **Connection Status**:
   - Handle user disconnect/reconnect
   - Show "Connecting..." state in header

## Usage

The online presence feature works automatically once the stores are initialized. To customize:

### Manually set users online:
```typescript
import { usePresenceStore } from './stores/presenceStore';

const { setUserOnline, setUserOffline } = usePresenceStore();

// Mark user online
setUserOnline('user3');

// Mark user offline
setUserOffline('user2');

// Set multiple users online
setMultipleUsersOnline(['user1', 'user2', 'agent']);
```

### Check if user is online:
```typescript
const { isUserOnline } = usePresenceStore();

if (isUserOnline('user1')) {
  console.log('User1 is online');
}
```

## Testing

Current mock data simulates this scenario:
- **Online**: user1 (Alice), user2 (Bob), user4, user5, agent
- **Offline**: user3 (Charlie), user6, user7

You can see the online indicators in:
1. **Chat Header**: Shows "5 online" with avatars
2. **Message List**: Green dots appear on messages from online users
3. **Sidebar**: (future enhancement) Could show online status next to team names

---

**Note**: This is currently a frontend-only feature with mock data. To make it functional, integrate with the backend WebSocket server using the `presence:update` events documented in `backend/README.md`.
