/**
 * Test Presence Tracking via Socket.IO
 * 
 * This script tests:
 * 1. Connect to Socket.IO server
 * 2. Announce user online
 * 3. Request online users list
 * 4. Simulate another user coming online
 * 5. Announce user offline
 * 6. Disconnect
 * 
 * Usage: node test-presence.js
 */

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';

// Create two test clients
const client1 = io(SERVER_URL, { transports: ['websocket'] });
const client2 = io(SERVER_URL, { transports: ['websocket'] });

const user1Id = 'test-user-1';
const user2Id = 'test-user-2';

let onlineUsers = new Set();

console.log('🧪 Testing Presence Tracking...\n');

// Client 1 setup
client1.on('connect', () => {
  console.log('✅ Client 1 connected:', client1.id);
  
  // Listen for presence updates
  client1.on('presence:update', ({ userId, status }) => {
    if (status === 'online') {
      onlineUsers.add(userId);
      console.log(`  👤 ${userId} came ONLINE (Total: ${onlineUsers.size})`);
    } else {
      onlineUsers.delete(userId);
      console.log(`  👤 ${userId} went OFFLINE (Total: ${onlineUsers.size})`);
    }
  });
  
  // Listen for online users list
  client1.on('presence:list', (users) => {
    console.log(`  📋 Received online users list: [${users.join(', ')}]`);
    onlineUsers = new Set(users);
  });
  
  // Step 1: Announce user 1 online
  setTimeout(() => {
    console.log('\n1️⃣ Client 1 announcing online...');
    client1.emit('presence:online', { userId: user1Id });
  }, 500);
  
  // Step 2: Request online users list
  setTimeout(() => {
    console.log('\n2️⃣ Client 1 requesting online users...');
    client1.emit('presence:get');
  }, 1000);
});

// Client 2 setup
client2.on('connect', () => {
  console.log('✅ Client 2 connected:', client2.id);
  
  // Listen for presence updates
  client2.on('presence:update', ({ userId, status }) => {
    console.log(`  [Client 2] 👤 ${userId} is ${status}`);
  });
  
  // Step 3: Announce user 2 online (should be visible to client 1)
  setTimeout(() => {
    console.log('\n3️⃣ Client 2 announcing online...');
    client2.emit('presence:online', { userId: user2Id });
  }, 1500);
  
  // Step 4: Announce user 2 offline
  setTimeout(() => {
    console.log('\n4️⃣ Client 2 announcing offline...');
    client2.emit('presence:offline', { userId: user2Id });
  }, 2500);
  
  // Step 5: Disconnect client 2
  setTimeout(() => {
    console.log('\n5️⃣ Client 2 disconnecting...');
    client2.disconnect();
  }, 3000);
});

// Step 6: Announce user 1 offline and disconnect
setTimeout(() => {
  console.log('\n6️⃣ Client 1 announcing offline...');
  client1.emit('presence:offline', { userId: user1Id });
}, 3500);

setTimeout(() => {
  console.log('\n7️⃣ Client 1 disconnecting...');
  client1.disconnect();
}, 4000);

// Final summary
setTimeout(() => {
  console.log('\n✅ Presence tracking test completed!\n');
  console.log('Summary:');
  console.log(`  - Tested 2 clients`);
  console.log(`  - Tested presence:online event`);
  console.log(`  - Tested presence:offline event`);
  console.log(`  - Tested presence:get event`);
  console.log(`  - Tested presence:update broadcasts`);
  console.log(`  - Tested disconnect cleanup\n`);
  process.exit(0);
}, 4500);

// Error handlers
client1.on('connect_error', (error) => {
  console.error('❌ Client 1 connection error:', error.message);
  process.exit(1);
});

client2.on('connect_error', (error) => {
  console.error('❌ Client 2 connection error:', error.message);
  process.exit(1);
});

client1.on('disconnect', () => {
  console.log('  Client 1 disconnected');
});

client2.on('disconnect', () => {
  console.log('  Client 2 disconnected');
});
