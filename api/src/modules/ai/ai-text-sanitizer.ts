const THOUGHT_BLOCK_PATTERN = /<thought\b[^>]*>[\s\S]*?<\/thought>/gi;
const INTERNAL_REASONING_BLOCK_PATTERN =
  /<internal_reasoning\b[^>]*>[\s\S]*?<\/internal_reasoning>/gi;
// MiniMax / DeepSeek-R1 / Qwen-QvQ 等推理模型会把思考过程包在 <think>...</think> 中。
const THINK_BLOCK_PATTERN = /<think\b[^>]*>[\s\S]*?<\/think>/gi;
const THOUGHT_TAG_PATTERN = /<\/?thought\b[^>]*>/gi;
const INTERNAL_REASONING_TAG_PATTERN = /<\/?internal_reasoning\b[^>]*>/gi;
const THINK_TAG_PATTERN = /<\/?think\b[^>]*>/gi;
const INTERNAL_SPEAKER_PREFIX_PATTERN = /^\[[^\]\n]{1,120}\]:\s*/gm;

export function sanitizeAiText(text: string): string {
  return text
    .replace(INTERNAL_REASONING_BLOCK_PATTERN, '')
    .replace(THOUGHT_BLOCK_PATTERN, '')
    .replace(THINK_BLOCK_PATTERN, '')
    .replace(INTERNAL_REASONING_TAG_PATTERN, '')
    .replace(THOUGHT_TAG_PATTERN, '')
    .replace(THINK_TAG_PATTERN, '')
    .replace(INTERNAL_SPEAKER_PREFIX_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
