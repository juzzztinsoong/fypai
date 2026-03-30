import OpenAI from 'openai';

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
  private client: OpenAI;
  private provider: 'github' | 'openai';
  private model: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private requestTimeoutMs: number;

  constructor() {
    const requestedProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
    const hasGitHubToken = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0);

    if (requestedProvider === 'openai') {
      this.provider = 'openai';
    } else if (requestedProvider === 'github') {
      this.provider = 'github';
    } else {
      // Preserve old behavior by defaulting to GitHub Models if a GitHub token exists.
      this.provider = hasGitHubToken ? 'github' : 'openai';
    }

    const apiKey = this.provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GITHUB_TOKEN;
    if (!apiKey) {
      throw new Error(
        this.provider === 'openai'
          ? 'OPENAI_API_KEY must be set when LLM_PROVIDER=openai'
          : 'GITHUB_TOKEN must be set when LLM_PROVIDER=github',
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL:
        this.provider === 'github'
          ? 'https://models.inference.ai.azure.com'
          : process.env.OPENAI_BASE_URL || undefined,
    });

    // Use Tier 2 (Smart) model as default for general queries.
    this.model = process.env.LLM_MODEL_TIER_2 || process.env.AI_MODEL || 'gpt-4o';

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

  private parseRetryAfterMs(error: unknown): number | null {
    const maybeAny = error as any;
    const retryAfterHeader = maybeAny?.headers?.['retry-after'] ?? maybeAny?.response?.headers?.['retry-after'];

    if (typeof retryAfterHeader === 'string' && /^\d+$/.test(retryAfterHeader)) {
      return Math.max(0, parseInt(retryAfterHeader, 10) * 1000);
    }

    const message =
      typeof maybeAny?.message === 'string'
        ? maybeAny.message
        : JSON.stringify(maybeAny || {});

    const match = /(?:please\s+)?wait\s+(\d+)\s+seconds/i.exec(message);
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
        const result = await this.withTimeout<any>(
          this.client.chat.completions.create({
            messages: request.messages,
            model: request.model || this.model,
            max_tokens: request.maxTokens || 4096,
            temperature: request.temperature || 0.7,
          }),
        );

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
      } catch (error) {
        const alreadyClassified = error instanceof LLMApiError;
        const isValidationError = error instanceof LLMResponseValidationError;
        const fallbackError = error instanceof Error ? error : new Error(String(error));

        if (!alreadyClassified) lastError = fallbackError;

        const statusCodeRaw = (error as any)?.status;
        const statusCode = Number.isFinite(Number(statusCodeRaw)) ? Number(statusCodeRaw) : 0;

        const retryable = alreadyClassified
          ? error.retryable
          : !isValidationError && (statusCode === 0 || this.isRetryableStatus(statusCode));

        if (statusCode > 0) {
          console.error('[LLMClient] API Error Details:', {
            provider: this.provider,
            status: statusCode,
            attempt,
            maxRetries: this.maxRetries,
            message: fallbackError.message,
          });
        }

        if (!retryable || attempt >= this.maxRetries) {
          throw (lastError || fallbackError);
        }

        const retryAfterMs = this.parseRetryAfterMs(error);
        await this.sleep(retryAfterMs ?? this.computeBackoffMs(attempt));
      }
    }

    throw (lastError || new Error('LLM generation failed after retries'));
  }

  async *generateStream(request: AIGenerationRequest): AsyncGenerator<string> {
    const response = await this.client.chat.completions.create({
        messages: request.messages,
        model: request.model || this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        stream: true,
    });

    for await (const chunk of response) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }
}