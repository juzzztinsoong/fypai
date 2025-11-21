/**
 * Embedding Service
 * 
 * Generates text embeddings using OpenAI's embedding models.
 * 
 * Tech Stack: OpenAI API (text-embedding-3-small)
 * Pattern: Stateless service with retry logic
 * 
 * Features:
 * - Generate embeddings for text
 * - Batch embedding generation
 * - Retry with exponential backoff
 * - Cost tracking (tokens used)
 * 
 * Environment Variables:
 * - OPENAI_API_KEY (fallback to GITHUB_TOKEN for GitHub Models)
 * - EMBEDDING_MODEL (default: text-embedding-3-small)
 */

import OpenAI from 'openai';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
  model: string;
}

class EmbeddingService {
  private client: OpenAI;
  private model: string;
  private maxRetries: number = 3;
  private totalTokensUsed: number = 0;
  private totalRequests: number = 0;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY or GITHUB_TOKEN must be set');
    }

    // For GitHub Models, use the Azure endpoint
    const isGitHubModels = !process.env.OPENAI_API_KEY && process.env.GITHUB_TOKEN;
    
    this.client = new OpenAI({
      apiKey,
      baseURL: isGitHubModels 
        ? 'https://models.inference.ai.azure.com'
        : undefined,
    });

    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    console.log(`[EmbeddingService] Initialized with model: ${this.model}`);
  }

  /**
   * Preprocess text to improve embedding quality
   * - Removes @mentions (e.g. @agent) which are structural, not semantic
   * - Collapses multiple spaces/newlines
   * - Trims whitespace
   */
  private preprocessText(text: string): string {
    return text
      .replace(/@[\w-]+/g, '') // Remove @mentions
      .replace(/\s+/g, ' ')    // Collapse whitespace
      .trim();
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const cleanedText = this.preprocessText(text);

    // Skip very short messages (not useful for semantic search)
    if (cleanedText.length < 5) {
      throw new Error('Text too short for embedding after preprocessing (minimum 5 characters)');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: cleanedText,
        });

        const embedding = response.data[0].embedding;
        const tokens = response.usage.total_tokens;

        this.totalTokensUsed += tokens;
        this.totalRequests++;

        console.log(`[EmbeddingService] ✅ Generated embedding (${embedding.length} dims, ${tokens} tokens) | Total: ${this.totalTokensUsed} tokens, ${this.totalRequests} requests`);

        return {
          embedding,
          tokens,
          model: response.model,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`[EmbeddingService] ❌ Attempt ${attempt}/${this.maxRetries} failed:`, error);

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`[EmbeddingService] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to generate embedding after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate embeddings for multiple texts in batch
   * OpenAI supports up to 2048 inputs per request
   */
  async generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      throw new Error('No texts provided');
    }

    if (texts.length > 2048) {
      throw new Error('Maximum 2048 texts per batch');
    }

    // Filter out empty/short texts after preprocessing
    const validTexts = texts
      .map(text => this.preprocessText(text))
      .filter(text => text.length >= 5);

    if (validTexts.length === 0) {
      throw new Error('No valid texts after filtering (all too short)');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: validTexts,
        });

        const embeddings = response.data.map(item => item.embedding);
        const totalTokens = response.usage.total_tokens;

        console.log(`[EmbeddingService] ✅ Generated ${embeddings.length} embeddings (${totalTokens} tokens)`);

        return {
          embeddings,
          totalTokens,
          model: response.model,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`[EmbeddingService] ❌ Batch attempt ${attempt}/${this.maxRetries} failed:`, error);

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[EmbeddingService] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to generate batch embeddings after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Alias for generateEmbeddings to match Phase 5 plan terminology
   */
  async generateBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    return this.generateEmbeddings(texts);
  }

  /**
   * Check if service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Generate embedding for a test string
      const result = await this.generateEmbedding('health check test');
      return result.embedding.length > 0;
    } catch (error) {
      console.error('[EmbeddingService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Estimate cost for embedding text
   * text-embedding-3-small: $0.02 per 1M tokens
   */
  estimateCost(tokens: number): number {
    const costPer1MTokens = 0.02;
    return (tokens / 1_000_000) * costPer1MTokens;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): { totalTokens: number; totalRequests: number; estimatedCost: number } {
    const estimatedCost = this.estimateCost(this.totalTokensUsed);
    return {
      totalTokens: this.totalTokensUsed,
      totalRequests: this.totalRequests,
      estimatedCost,
    };
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
