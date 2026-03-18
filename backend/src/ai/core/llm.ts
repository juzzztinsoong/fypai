// backend/src/ai/llm/githubModelsClient.ts
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

class LLMApiError extends Error {
  statusCode: number;
  retryable: boolean;

  constructor(message: string, statusCode: number, retryable: boolean) {
    super(message);
    this.name = 'LLMApiError';
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

class LLMResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseValidationError';
  }
}

export interface AIGenerationRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AIGenerationResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class GitHubModelsClient {
  private client: ReturnType<typeof ModelClient>;
  private model: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private requestTimeoutMs: number;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    const endpoint = "https://models.inference.ai.azure.com";
    
    this.client = ModelClient(
      endpoint, 
      new AzureKeyCredential(token!)
    );
    
    // Use Tier 2 (Smart) model as default for general queries
    this.model = process.env.LLM_MODEL_TIER_2 || process.env.AI_MODEL || "gpt-4o";

    this.maxRetries = parseInt(process.env.LLM_RETRY_MAX_ATTEMPTS || '3', 10);
    this.baseDelayMs = parseInt(process.env.LLM_RETRY_BASE_DELAY_MS || '1200', 10);
    this.maxDelayMs = parseInt(process.env.LLM_RETRY_MAX_DELAY_MS || '12000', 10);
    this.requestTimeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || '30000', 10);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`LLM request timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private isRetryableStatus(statusCode: number): boolean {
    return statusCode === 429 || statusCode >= 500;
  }

  private parseRetryAfterMs(responseBody: unknown): number | null {
    const raw = JSON.stringify(responseBody || {});
    const match = /please wait\s+(\d+)\s+seconds/i.exec(raw);
    if (!match) return null;

    const seconds = parseInt(match[1], 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;

    return Math.max(0, seconds * 1000);
  }

  private computeBackoffMs(attempt: number): number {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * Math.max(200, Math.floor(this.baseDelayMs / 2)));
    return exponential + jitter;
  }

  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.withTimeout<any>(this.client.path("/chat/completions").post({
          body: {
            messages: request.messages,
            model: request.model || this.model,
            max_tokens: request.maxTokens || 4096,
            temperature: request.temperature || 0.7,
          }
        }));

        if (response.status === "200") {
          const result = response.body as any; // Type assertion for Azure REST client
          const choices = Array.isArray(result?.choices) ? result.choices : [];
          if (choices.length === 0) {
            throw new LLMResponseValidationError('LLM response missing choices');
          }

          const choice = choices[0];
          const rawContent = choice?.message?.content;
          if (typeof rawContent !== 'string') {
            throw new LLMResponseValidationError('LLM response missing message content');
          }

          const content = rawContent.trim();
          if (!content) {
            throw new LLMResponseValidationError('LLM response content is empty after trim');
          }

          return {
            content,
            model: typeof result?.model === 'string' ? result.model : request.model || this.model,
            usage: {
              inputTokens: Number(result?.usage?.prompt_tokens) || 0,
              outputTokens: Number(result?.usage?.completion_tokens) || 0,
            },
          };
        }

        const statusCode = parseInt(response.status, 10);
        const retryable = this.isRetryableStatus(statusCode);

        console.error('[GitHubModelsClient] API Error Details:', {
          status: response.status,
          body: response.body,
          attempt,
          maxRetries: this.maxRetries,
        });

        lastError = new LLMApiError(
          `API error: ${response.status} - ${JSON.stringify(response.body)}`,
          statusCode,
          retryable,
        );

        if (!retryable || attempt >= this.maxRetries) {
          throw lastError;
        }

        const retryAfterMs = this.parseRetryAfterMs(response.body);
        const backoffMs = retryAfterMs ?? this.computeBackoffMs(attempt);
        await this.sleep(backoffMs);
      } catch (error) {
        const alreadyClassified = error instanceof LLMApiError;
        const isValidationError = error instanceof LLMResponseValidationError;
        const fallbackError = error instanceof Error ? error : new Error(String(error));

        if (!alreadyClassified) {
          lastError = fallbackError;
        }

        const retryable = alreadyClassified ? error.retryable : !isValidationError;

        if (!retryable || attempt >= this.maxRetries) {
          throw (lastError || fallbackError);
        }

        await this.sleep(this.computeBackoffMs(attempt));
      }
    }

    throw (lastError || new Error('LLM generation failed after retries'));
  }

  async *generateStream(request: AIGenerationRequest): AsyncGenerator<string> {
    const response = await this.client.path("/chat/completions").post({
      body: {
        messages: request.messages,
        model: request.model || this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        stream: true,
      }
    });

    const body = response.body as any; // Type assertion for streaming response
    for await (const chunk of body) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }
}