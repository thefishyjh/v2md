import axios from 'axios';

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

export class DeepSeekProvider {
  constructor(apiKey) {
    this.client = axios.create({
      baseURL: 'https://api.deepseek.com',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  async generate(subtitle, numPoints) {
    const response = await this.client.post('/chat/completions', {
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `请提取 ${numPoints} 个关键知识点，仅返回 JSON，格式: {"keypoints":[{"time":"1:23","title":"...","description":"..."}]}。time 使用 mm:ss。\n\n文本:\n${String(subtitle || '').slice(0, 12000)}`,
      }],
    });

    const raw = response?.data?.choices?.[0]?.message?.content;
    const parsed = extractJsonObject(raw);
    return normalizeKeypoints(parsed);
  }
}
