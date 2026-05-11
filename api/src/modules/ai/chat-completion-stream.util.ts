import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';

export type ChatCompletionTaskResult = {
  usage?:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      }
    | null;
  model?: string | null;
  choices: Array<{
    message?: {
      content?: string | null;
    } | null;
    finish_reason?: string | null;
  }>;
};

// 已知必须强制 stream 的模型族（n1n.ai 网关上 GLM-4.5 / GLM-4.5-Air 只接受流式）。
const STREAM_ONLY_MODEL_PATTERNS: RegExp[] = [/^glm-/i];

export function requiresStreamMode(model: string | null | undefined): boolean {
  if (!model) return false;
  return STREAM_ONLY_MODEL_PATTERNS.some((pattern) => pattern.test(model.trim()));
}

export function isStreamRequiredError(error: unknown): boolean {
  const message = extractErrorMessageText(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes('only support stream mode') ||
    message.includes('only supports stream mode') ||
    message.includes('must be streamed') ||
    message.includes('please enable the stream parameter') ||
    message.includes('stream is required')
  );
}

export async function aggregateStreamingChatCompletion(
  client: OpenAI,
  params: ChatCompletionCreateParamsNonStreaming,
  options?: { timeout?: number; maxRetries?: number },
): Promise<ChatCompletionTaskResult> {
  const stream = await client.chat.completions.create(
    {
      ...params,
      stream: true,
      stream_options: { include_usage: true },
    },
    options,
  );

  let content = '';
  let finishReason: string | null = null;
  let model: string | null = null;
  let usage: ChatCompletion['usage'] | null = null;
  for await (const chunk of stream) {
    if (!model && chunk.model) {
      model = chunk.model;
    }
    const choice = chunk.choices?.[0];
    if (choice) {
      const delta = choice.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        content += delta;
      }
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }
    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  return {
    model: model ?? params.model,
    usage,
    choices: [
      {
        message: { content },
        finish_reason: finishReason,
      },
    ],
  };
}

export async function executeChatCompletion(
  client: OpenAI,
  params: ChatCompletionCreateParamsNonStreaming,
  options?: { timeout?: number; maxRetries?: number },
): Promise<ChatCompletionTaskResult> {
  if (requiresStreamMode(params.model)) {
    return aggregateStreamingChatCompletion(client, params, options);
  }

  try {
    return await client.chat.completions.create(
      { ...params, stream: false },
      options,
    );
  } catch (error) {
    if (isStreamRequiredError(error)) {
      return aggregateStreamingChatCompletion(client, params, options);
    }
    throw error;
  }
}

function extractErrorMessageText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const anyErr = error as Record<string, unknown>;
    if (typeof anyErr.message === 'string') return anyErr.message;
    const inner = anyErr.error;
    if (inner && typeof inner === 'object') {
      const innerMsg = (inner as Record<string, unknown>).message;
      if (typeof innerMsg === 'string') return innerMsg;
    }
  }
  return '';
}
