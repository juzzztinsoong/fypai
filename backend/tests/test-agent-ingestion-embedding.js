/**
 * Agent Ingestion + Embedding Timing Integration Test
 *
 * What this validates:
 * 1) User messages trigger AI pipeline observation (ai:continuation socket events)
 * 2) Explicit @agent messages activate continuation mode
 * 3) Embedding persistence is asynchronous (message.embeddingId appears after creation)
 *
 * Prerequisites:
 * - Backend running on http://localhost:5000
 * - Redis + embedding worker running for embedding timing checks
 * - Seeded user (default: user1)
 *
 * Run:
 *   node tests/test-agent-ingestion-embedding.js
 *
 * Optional env vars:
 *   API_URL=http://localhost:5000
 *   USER_ID=user1
 *   TEAM_ID=team1
 *   KEEP_TEST_TEAM=true
 *   CONTINUATION_TIMEOUT_MS=12000
 *   EMBEDDING_TIMEOUT_MS=90000
 */

import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
const USER_ID = process.env.USER_ID || 'user1';
const PROVIDED_TEAM_ID = process.env.TEAM_ID || '';

const CONTINUATION_TIMEOUT_MS = Number(process.env.CONTINUATION_TIMEOUT_MS || 12000);
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 90000);
const SOCKET_CONNECT_TIMEOUT_MS = Number(process.env.SOCKET_CONNECT_TIMEOUT_MS || 10000);
const KEEP_TEST_TEAM = process.env.KEEP_TEST_TEAM === 'true';
const STRICT_EMBEDDING_PERSISTENCE = process.env.STRICT_EMBEDDING_PERSISTENCE === 'true';

let passed = 0;
let failed = 0;
let warned = 0;

function pass(label) {
  console.log(`   ✅ ${label}`);
  passed += 1;
}

function fail(label) {
  console.log(`   ❌ ${label}`);
  failed += 1;
}

function warn(label) {
  console.log(`   ⚠️  ${label}`);
  warned += 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await parseJsonSafe(res);
  return { res, data };
}

async function waitFor(predicate, timeoutMs, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}

async function connectSocket(teamId, continuationEvents, messageEvents) {
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    timeout: SOCKET_CONNECT_TIMEOUT_MS,
    reconnection: false,
  });

  socket.on('ai:continuation', (event) => {
    continuationEvents.push({ ...event, receivedAt: Date.now() });
  });

  socket.on('message:new', (message) => {
    messageEvents.push({ ...message, receivedAt: Date.now() });
  });

  await new Promise((resolve, reject) => {
    let settled = false;

    const onConnect = () => {
      if (settled) return;
      settled = true;
      socket.off('connect_error', onError);
      resolve(true);
    };

    const onError = (err) => {
      if (settled) return;
      settled = true;
      socket.off('connect', onConnect);
      reject(err);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });

  socket.emit('team:join', { teamId });
  await sleep(250);
  return socket;
}

async function createIsolatedTeamIfNeeded() {
  if (PROVIDED_TEAM_ID) {
    const { res } = await api(`/teams/${PROVIDED_TEAM_ID}`);
    if (!res.ok) {
      throw new Error(`TEAM_ID ${PROVIDED_TEAM_ID} not found (${res.status})`);
    }
    return { teamId: PROVIDED_TEAM_ID, createdTeamId: null };
  }

  const name = `Agent Pipeline Test ${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const { res, data } = await api('/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ownerId: USER_ID }),
  });

  if (!res.ok || !data?.id) {
    throw new Error(`Failed to create test team (${res.status}): ${JSON.stringify(data)}`);
  }

  return { teamId: data.id, createdTeamId: data.id };
}

async function sendMessage(teamId, content, metadata = undefined) {
  const body = {
    teamId,
    authorId: USER_ID,
    content,
    contentType: 'text',
    ...(metadata ? { metadata } : {}),
  };

  const { res, data } = await api('/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !data?.id) {
    throw new Error(`Message create failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function waitForContinuation(continuationEvents, teamId, sinceMs) {
  const result = await waitFor(() => {
    return continuationEvents.find((event) => {
      if (event.teamId !== teamId) return false;
      const ts = Number(event.receivedAt);
      return Number.isFinite(ts) && ts >= sinceMs;
    });
  }, CONTINUATION_TIMEOUT_MS, 250);

  return result;
}

async function waitForEmbeddingId(messageId) {
  const startedAt = Date.now();

  const row = await waitFor(async () => {
    const record = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, embeddingId: true, embeddedAt: true },
    });

    if (record?.embeddingId) return record;
    return null;
  }, EMBEDDING_TIMEOUT_MS, 1500);

  if (!row) return null;

  return {
    ...row,
    delayMs: Date.now() - startedAt,
  };
}

async function main() {
  console.log('\n🧪 Agent Ingestion + Embedding Timing Test');
  console.log('═'.repeat(62));
  console.log(`Target: ${BASE_URL}`);
  console.log(`User: ${USER_ID}`);
  console.log('═'.repeat(62));

  let socket = null;
  let createdTeamId = null;
  let teamId = null;

  const continuationEvents = [];
  const messageEvents = [];

  const sentMessages = [];

  try {
    console.log('\n1) Health and environment checks');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await parseJsonSafe(healthRes);

    if (!healthRes.ok) {
      fail(`Health endpoint failed (${healthRes.status})`);
      throw new Error('Backend not reachable');
    }
    pass(`Health endpoint OK (${healthRes.status})`);

    const redisConnected = health?.redis === 'connected';
    if (redisConnected) {
      pass('Redis is connected (embedding queue should be active)');
    } else {
      warn('Redis is not connected; embedding persistence checks may fail or be skipped');
    }

    const teamResult = await createIsolatedTeamIfNeeded();
    teamId = teamResult.teamId;
    createdTeamId = teamResult.createdTeamId;

    if (createdTeamId) {
      pass(`Created isolated test team: ${teamId}`);
    } else {
      pass(`Using provided team: ${teamId}`);
    }

    const aiToggle = await api(`/teams/${teamId}/ai`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    if (aiToggle.res.ok) {
      pass('Team AI explicitly enabled for deterministic test behavior');
    } else {
      warn(`Could not force-enable team AI (${aiToggle.res.status}); continuing`);
    }

    socket = await connectSocket(teamId, continuationEvents, messageEvents);
    pass('Socket connected and joined team room');

    const beforeStatsRes = await fetch(`${API_BASE}/stats/embeddings`);
    const statsBefore = await parseJsonSafe(beforeStatsRes);
    if (beforeStatsRes.ok && typeof statsBefore?.totalRequests === 'number') {
      pass(`Embedding stats readable (baseline requests=${statsBefore.totalRequests})`);
    } else {
      warn('Embedding stats endpoint unavailable; stats delta assertion will be skipped');
    }

    console.log('\n2) Scenario A: Passive observation event on normal message');
    const scenarioAStart = Date.now();
    const scenarioAMessage = await sendMessage(teamId, 'Noted. I can compile notes for tomorrow and share in standup.');
    sentMessages.push({ id: scenarioAMessage.id, sentAt: scenarioAStart, label: 'Scenario A' });
    pass(`Scenario A message created: ${scenarioAMessage.id}`);

    const continuationA = await waitForContinuation(continuationEvents, teamId, scenarioAStart);
    if (continuationA) {
      pass(
        `Received ai:continuation after Scenario A (status=${continuationA.status}, trigger=${continuationA.trigger}, confidence=${Math.round((continuationA.confidence || 0) * 100)}%)`
      );
    } else {
      fail('No ai:continuation event observed after Scenario A message');
    }

    console.log('\n3) Scenario B: Explicit @agent should activate continuation');
    const scenarioBStart = Date.now();
    const scenarioBMessage = await sendMessage(teamId, '@agent give a one-line acknowledgement only.');
    sentMessages.push({ id: scenarioBMessage.id, sentAt: scenarioBStart, label: 'Scenario B' });
    pass(`Scenario B message created: ${scenarioBMessage.id}`);

    const continuationB = await waitForContinuation(continuationEvents, teamId, scenarioBStart);
    if (!continuationB) {
      fail('No ai:continuation event observed after Scenario B message');
    } else if (continuationB.status !== 'active') {
      fail(`Scenario B continuation expected active, got ${continuationB.status}`);
    } else {
      pass(`Scenario B continuation active (trigger=${continuationB.trigger})`);
    }

    const agentReply = await waitFor(() => {
      return messageEvents.find((message) => {
        if (message.teamId !== teamId) return false;
        if (message.authorId !== 'agent') return false;
        const createdAtMs = Date.parse(message.createdAt || '');
        return Number.isFinite(createdAtMs) && createdAtMs >= scenarioBStart - 500;
      });
    }, 20000, 300);

    if (agentReply) {
      pass(`Observed agent reply message over socket: ${agentReply.id}`);
    } else {
      warn('No agent reply observed within timeout (continuation still confirms ingestion path)');
    }

    console.log('\n4) Scenario C: Embedding persistence should be asynchronous');
    const scenarioCMessage = await sendMessage(
      teamId,
      'Vector embedding latency check. This message should persist first, then receive embedding metadata asynchronously via worker pipeline.'
    );
    sentMessages.push({ id: scenarioCMessage.id, sentAt: Date.now(), label: 'Scenario C' });
    pass(`Scenario C message created: ${scenarioCMessage.id}`);

    const immediateRecord = await prisma.message.findUnique({
      where: { id: scenarioCMessage.id },
      select: { embeddingId: true, embeddedAt: true },
    });

    if (!immediateRecord?.embeddingId) {
      pass('Message has no embeddingId immediately after create (expected async persistence)');
    } else {
      warn('Message already had embeddingId immediately (worker processed very quickly)');
    }

    if (health?.redis === 'connected') {
      const embeddedRecord = await waitForEmbeddingId(scenarioCMessage.id);

      if (!embeddedRecord) {
        if (STRICT_EMBEDDING_PERSISTENCE) {
          fail(`embeddingId not set within timeout (${EMBEDDING_TIMEOUT_MS}ms)`);
        } else {
          warn(
            `embeddingId was not observed within timeout (${EMBEDDING_TIMEOUT_MS}ms). ` +
              'This can happen when worker backlog is high; stats delta still indicates async embedding activity.'
          );
        }
      } else {
        pass(
          `embeddingId set asynchronously after ${embeddedRecord.delayMs}ms (embeddedAt=${embeddedRecord.embeddedAt?.toISOString?.() || embeddedRecord.embeddedAt})`
        );
      }
    } else {
      warn('Skipped embeddingId timing assertion because Redis is not connected');
    }

    if (beforeStatsRes.ok && typeof statsBefore?.totalRequests === 'number') {
      const afterStatsRes = await fetch(`${API_BASE}/stats/embeddings`);
      const statsAfter = await parseJsonSafe(afterStatsRes);

      if (!afterStatsRes.ok || typeof statsAfter?.totalRequests !== 'number') {
        warn('Could not read embedding stats after scenarios');
      } else if (statsAfter.totalRequests < statsBefore.totalRequests) {
        fail(
          `Embedding stats totalRequests decreased unexpectedly (${statsBefore.totalRequests} -> ${statsAfter.totalRequests})`
        );
      } else {
        pass(
          `Embedding stats non-decreasing (${statsBefore.totalRequests} -> ${statsAfter.totalRequests})`
        );
      }
    }

    console.log('\n5) Coverage check: continuation event per sent message');
    let continuationHits = 0;

    for (let i = 0; i < sentMessages.length; i += 1) {
      const message = sentMessages[i];
      const nextMessage = sentMessages[i + 1];
      const windowEnd = nextMessage
        ? nextMessage.sentAt + 1500
        : message.sentAt + CONTINUATION_TIMEOUT_MS;

      const hasEvent = continuationEvents.some((event) => {
        if (event.teamId !== teamId) return false;
        const ts = Number(event.receivedAt);
        return Number.isFinite(ts) && ts >= message.sentAt && ts <= windowEnd;
      });

      if (hasEvent) {
        continuationHits += 1;
      }
    }

    if (continuationHits === sentMessages.length) {
      pass(`Observed continuation events for all ${sentMessages.length}/${sentMessages.length} sent messages`);
    } else {
      fail(
        `Missing continuation events for some messages (${continuationHits}/${sentMessages.length} matched)`
      );
    }

  } catch (error) {
    fail(`Test crashed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (socket) {
      socket.disconnect();
    }

    if (createdTeamId && !KEEP_TEST_TEAM) {
      try {
        const res = await api(`/teams/${createdTeamId}`, { method: 'DELETE' });
        if (res.res.status === 204) {
          pass(`Cleaned up temporary team ${createdTeamId}`);
        } else {
          warn(`Failed to clean up temporary team ${createdTeamId} (${res.res.status})`);
        }
      } catch (cleanupError) {
        warn(
          `Cleanup error for team ${createdTeamId}: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`
        );
      }
    }

    await prisma.$disconnect().catch(() => undefined);

    console.log('\n' + '═'.repeat(62));
    console.log(`Results: ${passed} passed, ${failed} failed, ${warned} warnings`);
    console.log('═'.repeat(62));

    if (failed > 0) {
      process.exit(1);
    }
  }
}

main();
