# Copilot Instructions: Fix React 18 Remount Issue

## Context
The app gets stuck on loading screen after React 18's automatic unmount/remount in dev mode. Socket connects but handlers aren't re-registered on remount because `useEffect` with empty deps `[]` only runs once.

## Solution Overview
Move socket initialization and handler registration outside React lifecycle. React components only manage UI state, not socket lifecycle.

---

## Step 1: Create Global Realtime Initialization Module

Create `frontend/src/services/realtimeInit.ts` with these requirements:

- Export `initializeRealtime(userId: string): Promise<void>` function
- Use closure variables `initPromise` and `isInitialized` to track state
- Make function idempotent - safe to call multiple times
- If already initialized and connected, return immediately with `Promise.resolve()`
- If initialization in progress, return existing `initPromise`
- Connect to socket using `socketService.connect(userId)`
- Register ALL socket event handlers ONCE (they persist across remounts):
  - `message:new` → calls `useEntityStore.getState().addMessage(message)`
  - `message:edited` → calls `useEntityStore.getState().updateMessage(message.id, message)`
  - `message:deleted` → calls `useEntityStore.getState().deleteMessage(data.messageId)`
  - `presence:update` → calls `useEntityStore.getState().updatePresence(data.teamId, data.users)`
  - `typing:start` → calls `useEntityStore.getState().setUserTyping(data.teamId, data.userId, true)`
  - `typing:stop` → calls `useEntityStore.getState().setUserTyping(data.teamId, data.userId, false)`
- Set `isInitialized = true` after handlers registered
- Add console.logs for debugging
- Export `resetRealtime()` function that resets `initPromise` and `isInitialized` to null/false
- Export `isRealtimeInitialized()` function that returns `isInitialized && socketService.getSocket()?.connected === true`

---

## Step 2: Simplify RealtimeProvider

Update `frontend/src/providers/RealtimeProvider.tsx`:

- Remove all socket handler registration code from this component
- Remove all `socket.on()` and `socket.off()` calls
- Import `initializeRealtime` and `isRealtimeInitialized` from `realtimeInit.ts`
- Initialize `isReady` state using lazy initializer: `useState(() => isRealtimeInitialized())`
- In `useEffect`:
  - First check if `isRealtimeInitialized()` is true, if so just call `setIsReady(true)` and return
  - Use a `mounted` flag to prevent state updates after unmount
  - Call `initializeRealtime(userId).then()` to initialize
  - On success: if `mounted`, call `setIsReady(true)` and `setError(null)`
  - On error: if `mounted`, call `setError(err.message)`
  - In cleanup function: set `mounted = false`, add comment "DON'T clean up socket or handlers - they persist"
- Keep dependency array as `[userId]`
- Keep error display UI
- Keep loading display UI
- Remove all `useRef` variables
- Remove all socket event handler cleanup code

---

## Step 3: Update socketService to be More Defensive

Update `frontend/src/services/socketService.ts`:

In the `SocketService` class:
- Add private property `connectionPromise: Promise<void> | null = null`
- In `connect()` method:
  - If `this.socket?.connected` is true, return `Promise.resolve()` immediately
  - If `this.connectionPromise` exists, return it (connection in progress)
  - If socket exists but not connected, try to reconnect existing socket:
    - Call `this.socket.connect()`
    - Listen for `connect` event once, resolve promise and set `connectionPromise = null`
    - Listen for `connect_error` event once, reject promise and set `connectionPromise = null`
  - Otherwise create new socket with io() as before
  - Store promise in `this.connectionPromise` before returning it
  - Clear `connectionPromise = null` in both connect success and error handlers
- Add method `isConnected(): boolean` that returns `this.socket?.connected === true`
- In `disconnect()` method: also set `this.connectionPromise = null`

---

## Step 4: Fix App.tsx Team Room Cleanup

Update `frontend/src/App.tsx`:

- Find the `useEffect` that handles team room join/leave
- Change it to only run when `currentTeamId` changes (keep `[currentTeamId]` dependency)
- In effect body:
  - Log current team with console.log
  - If `currentTeamId` exists, get socket and emit `team:join` event
- In cleanup function:
  - Add comment "Only leave room if we're actually switching teams or unmounting"
  - Keep the `team:leave` emit logic
- Remove any `useRef` hacks or initialization flags
- Keep the render counter if it exists for debugging

---

## Step 5: Add Reset on Full App Unmount

Update `frontend/src/main.tsx`:

- Import `resetRealtime` from `./services/realtimeInit`
- Import `socketService` from `./services/socketService`
- Before `createRoot()`, add window event listener:
  ```typescript
  window.addEventListener('beforeunload', () => {
    resetRealtime();
    socketService.disconnect();
  });
  ```
- Keep existing StrictMode and RealtimeProvider structure

---

## Key Principles

1. **Socket lifecycle is OUTSIDE React** - Socket and handlers initialize once globally, persist across remounts
2. **Idempotent operations** - Safe to call `initializeRealtime()` multiple times
3. **React manages UI state only** - Components track `isReady` for rendering, not socket lifecycle  
4. **No cleanup of persistent resources** - Don't remove handlers or disconnect socket on React unmount
5. **Lazy state initialization** - Check if already initialized before showing loading screen

## Expected Behavior After Fix

- First mount: Initialize socket and handlers, show content
- Unmount (React 18 dev mode): Cleanup function runs but does nothing
- Remount: Immediately detect already initialized, show content (no loading)
- Console should show "Already initialized" on remount
- No duplicate handler registrations
- No stuck loading screen

## Files to Modify

1. **CREATE** `frontend/src/services/realtimeInit.ts` (new file)
2. **UPDATE** `frontend/src/providers/RealtimeProvider.tsx` (simplify dramatically)
3. **UPDATE** `frontend/src/services/socketService.ts` (add connection promise tracking)
4. **UPDATE** `frontend/src/App.tsx` (fix team room effect dependencies)
5. **UPDATE** `frontend/src/main.tsx` (add cleanup on page unload)

## What to Remove

- All `useRef` variables for initialization tracking
- All `socket.on()` calls from RealtimeProvider
- All `socket.off()` calls from RealtimeProvider cleanup
- Any `isInitialized` flags in RealtimeProvider component
- Any `hasInitialized.current` ref checks

## Testing Checklist

- [ ] App loads without stuck loading screen
- [ ] Console shows "Already initialized" on remount
- [ ] No duplicate "Connecting to WebSocket" logs
- [ ] Messages still appear in real-time
- [ ] Presence updates still work
- [ ] Typing indicators still work
- [ ] Switching teams still emits join/leave events
- [ ] No React warnings or errors in console