import Anthropic from '@anthropic-ai/sdk';

function extractJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeKeypoints(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.keypoints)) return payload.keypoints;
  return [];
}

export class AnthropicProvider {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(subtitle, numPoints) {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `请从下面文本提取 ${numPoints} 个关键知识点，并仅返回 JSON。格式: {"keypoints":[{"time":"1:23","title":"...","description":"..."}]}。time 使用 mm:ss。\n\n文本:\n${String(subtitle || '').slice(0, 12000)}`,
      }],
    });

    const text = response?.content?.[0]?.text || '';
    const parsed = extractJsonObject(text);
    return normalizeKeypoints(parsed);
  }
}
