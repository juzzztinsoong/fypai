/**
 * Pinecone Service
 * 
 * Vector database service for semantic search and RAG.
 * 
 * Tech Stack: Pinecone (cloud vector DB)
 * Pattern: Singleton with connection pooling
 * 
 * Features:
 * - Vector storage (upsert embeddings with metadata)
 * - Semantic search (query by vector similarity)
 * - Batch operations (upsert multiple vectors)
 * - Health checks
 * 
 * Environment Variables:
 * - PINECONE_API_KEY
 * - PINECONE_ENVIRONMENT
 * - PINECONE_INDEX_NAME
 * - EMBEDDING_DIMENSIONS
 */

import { Pinecone } from '@pinecone-database/pinecone';

export interface PineconeMetadata {
  messageId: string;
  teamId: string;
  authorId: string;
  content: string; // Stored for debugging/preview
  createdAt: string; // ISO timestamp
  contentType: string;
}

export interface VectorRecord {
  id: string; // Pinecone vector ID (uuid)
  values: number[]; // Embedding vector
  metadata: PineconeMetadata;
}

export interface SearchResult {
  messageId: string;
  score: number; // Cosine similarity (0-1)
  content: string;
  teamId: string;
  authorId: string;
  createdAt: string;
}

class PineconeService {
  private client: Pinecone | null = null;
  private indexName: string;
  private dimensions: number;
  private initialized: boolean = false;

  // Circuit Breaker State
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private static readonly MAX_FAILURES = 5;
  private static readonly CIRCUIT_RESET_TIME = 60000; // 1 minute

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'fypai-messages';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
  }

  /**
   * Check if circuit breaker is open
   */
  private checkCircuit(): void {
    if (this.failureCount >= PineconeService.MAX_FAILURES) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < PineconeService.CIRCUIT_RESET_TIME) {
        const remaining = Math.ceil((PineconeService.CIRCUIT_RESET_TIME - timeSinceLastFailure) / 1000);
        console.warn(`[Pinecone] 🔌 Circuit breaker OPEN. Skipping request. (Reset in ${remaining}s)`);
        throw new Error('Pinecone circuit breaker is open');
      } else {
        // Half-open state: allow one request to try and reset
        console.log('[Pinecone] 🔌 Circuit breaker half-open. Retrying...');
      }
    }
  }

  /**
   * Record a failure and potentially trip the circuit
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= PineconeService.MAX_FAILURES) {
      console.error(`[Pinecone] 💥 Circuit breaker TRIPPED after ${this.failureCount} failures.`);
    }
  }

  /**
   * Record a success and reset the circuit
   */
  private recordSuccess(): void {
    if (this.failureCount > 0) {
      console.log('[Pinecone] 🔌 Circuit breaker reset. Service is healthy.');
      this.failureCount = 0;
      this.lastFailureTime = 0;
    }
  }

  /**
   * Initialize Pinecone client and ensure index exists
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const apiKey = process.env.PINECONE_API_KEY;
      if (!apiKey) {
        throw new Error('PINECONE_API_KEY is not set in environment variables');
      }

      this.client = new Pinecone({ apiKey });

      // Check if index exists, create if not
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`[Pinecone] Creating index: ${this.indexName} (${this.dimensions} dimensions)`);
        await this.client.createIndex({
          name: this.indexName,
          dimension: this.dimensions,
          metric: 'cosine', // Cosine similarity for semantic search
          spec: {
            serverless: {
              cloud: 'aws',
              region: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
            },
          },
        });
        console.log(`[Pinecone] ✅ Index created successfully`);
      } else {
        console.log(`[Pinecone] ✅ Connected to existing index: ${this.indexName}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[Pinecone] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Pinecone index instance
   */
  private getIndex() {
    if (!this.client || !this.initialized) {
      throw new Error('Pinecone service not initialized. Call initialize() first.');
    }
    return this.client.index(this.indexName);
  }

  /**
   * Upsert a single vector with metadata
   */
  async upsertVector(record: VectorRecord): Promise<void> {
    this.checkCircuit();
    try {
      const index = this.getIndex();
      await index.upsert([
        {
          id: record.id,
          values: record.values,
          metadata: record.metadata as any,
        },
      ]);
      console.log(`[Pinecone] ✅ Upserted vector: ${record.id} (message: ${record.metadata.messageId})`);
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      console.error('[Pinecone] ❌ Failed to upsert vector:', error);
      throw error;
    }
  }

  /**
   * Upsert multiple vectors in batch
   */
  async upsertVectors(records: VectorRecord[]): Promise<void> {
    this.checkCircuit();
    try {
      const index = this.getIndex();
      const vectors = records.map(record => ({
        id: record.id,
        values: record.values,
        metadata: record.metadata as any,
      }));

      await index.upsert(vectors);
      console.log(`[Pinecone] ✅ Batch upserted ${records.length} vectors`);
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      console.error('[Pinecone] ❌ Failed to batch upsert vectors:', error);
      throw error;
    }
  }

  /**
   * Query vectors by similarity (semantic search)
   */
  async queryVectors(
    embedding: number[],
    teamId: string,
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<SearchResult[]> {
    this.checkCircuit();
    try {
      const index = this.getIndex();
      
      const queryResponse = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: { teamId: { $eq: teamId } }, // Filter by team
      });

      const results: SearchResult[] = (queryResponse.matches || [])
        .filter(match => (match.score || 0) >= minScore)
        .map(match => ({
          messageId: (match.metadata?.messageId as string) || '',
          score: match.score || 0,
          content: (match.metadata?.content as string) || '',
          teamId: (match.metadata?.teamId as string) || '',
          authorId: (match.metadata?.authorId as string) || '',
          createdAt: (match.metadata?.createdAt as string) || '',
        }));

      console.log(`[Pinecone] 🔍 Found ${results.length} similar vectors (score >= ${minScore})`);
      this.recordSuccess();
      return results;
    } catch (error) {
      this.recordFailure();
      console.error('[Pinecone] ❌ Query failed:', error);
      throw error;
    }
  }

  /**
   * Delete vector by ID
   */
  async deleteVector(vectorId: string): Promise<void> {
    try {
      const index = this.getIndex();
      await index.deleteOne(vectorId);
      console.log(`[Pinecone] 🗑️ Deleted vector: ${vectorId}`);
    } catch (error) {
      console.error('[Pinecone] ❌ Delete failed:', error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a team
   */
  async deleteTeamVectors(teamId: string): Promise<void> {
    try {
      const index = this.getIndex();
      await index.deleteMany({ teamId });
      console.log(`[Pinecone] 🗑️ Deleted all vectors for team: ${teamId}`);
    } catch (error) {
      console.error('[Pinecone] ❌ Failed to delete team vectors:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const stats = await this.getIndex().describeIndexStats();
      console.log(`[Pinecone] 💚 Health check OK - ${stats.totalRecordCount || 0} vectors indexed`);
      return true;
    } catch (error) {
      console.error('[Pinecone] ❤️ Health check failed:', error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<{ totalVectors: number; dimension: number }> {
    try {
      const stats = await this.getIndex().describeIndexStats();
      return {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || this.dimensions,
      };
    } catch (error) {
      console.error('[Pinecone] ❌ Failed to get stats:', error);
      throw error;
    }
  }
}

// Singleton instance
export const pineconeService = new PineconeService();
