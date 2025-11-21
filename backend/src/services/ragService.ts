/**
 * RAG Service (Retrieval-Augmented Generation)
 * 
 * Retrieves relevant context from vector database for AI responses.
 * 
 * Tech Stack: Pinecone + Embedding Service
 * Pattern: Semantic search with recency weighting
 * 
 * Features:
 * - Semantic search for relevant messages
 * - Recency weighting (newer messages score higher)
 * - Team-scoped search
 * - Configurable result count and similarity threshold
 */

import { embeddingService } from './embeddingService.js';
import { pineconeService, SearchResult } from './pineconeService.js';
import { MessageDTO } from '../types.js';
import { prisma } from '../db.js';

export interface RAGContext {
  query: string;
  relevantMessages: MessageDTO[];
  totalResults: number;
  avgSimilarity: number;
}

class RAGService {
  /**
   * Get relevant context for a query using semantic search
   */
  async getRelevantContext(
    query: string,
    teamId: string,
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<RAGContext> {
    try {
      // Step 1: Generate embedding for query
      const { embedding } = await embeddingService.generateEmbedding(query);

      // Step 2: Search Pinecone for similar messages
      const results = await pineconeService.queryVectors(embedding, teamId, topK, minScore);

      if (results.length === 0) {
        return {
          query,
          relevantMessages: [],
          totalResults: 0,
          avgSimilarity: 0,
        };
      }

      // Step 3: Fetch full message details from database
      const messageIds = results.map(r => r.messageId);
      const messages = await prisma.message.findMany({
        where: { id: { in: messageIds } },
        include: {
          author: {
            select: { id: true, name: true, avatar: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      // Step 4: Convert to DTOs with similarity scores
      const messageDTOs: MessageDTO[] = messages.map(msg => {
        const result = results.find(r => r.messageId === msg.id)!;
        return {
          id: msg.id,
          teamId: msg.teamId,
          authorId: msg.authorId,
          content: msg.content,
          contentType: msg.contentType as 'text',
          createdAt: msg.createdAt.toISOString(),
          metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined,
          author: {
            ...msg.author,
            role: msg.author.role as 'member' | 'admin',
          },
          relevanceScore: result.score,
        };
      });

      const avgSimilarity = results.reduce((sum, r) => sum + r.score, 0) / results.length;

      console.log(`[RAGService] 🔍 Found ${messageDTOs.length} relevant messages (avg similarity: ${avgSimilarity.toFixed(3)})`);

      return {
        query,
        relevantMessages: messageDTOs,
        totalResults: results.length,
        avgSimilarity,
      };
    } catch (error) {
      console.error('[RAGService] ❌ Failed to get relevant context:', error);
      throw error;
    }
  }

  /**
   * Check if RAG service is ready
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pineconeOK = await pineconeService.healthCheck();
      const embeddingOK = await embeddingService.healthCheck();
      return pineconeOK && embeddingOK;
    } catch (error) {
      return false;
    }
  }
}

export const ragService = new RAGService();
