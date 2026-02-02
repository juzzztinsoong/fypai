// backend/src/ai/llm/githubModelsClient.ts
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

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

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    const endpoint = "https://models.inference.ai.azure.com";
    
    this.client = ModelClient(
      endpoint, 
      new AzureKeyCredential(token!)
    );
    
    // Use Tier 2 (Smart) model as default for general queries
    this.model = process.env.LLM_MODEL_TIER_2 || process.env.AI_MODEL || "gpt-4o";
  }

  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const response = await this.client.path("/chat/completions").post({
      body: {
        messages: request.messages,
        model: request.model || this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
      }
    });

    if (response.status !== "200") {
      console.error('[GitHubModelsClient] API Error Details:', response.body);
      throw new Error(`API error: ${response.status} - ${JSON.stringify(response.body)}`);
    }

    const result = response.body as any; // Type assertion for Azure REST client
    const choice = result.choices[0];

    return {
      content: choice.message.content,
      model: result.model,
      usage: {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
      },
    };
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