import axios from 'axios';

function normalizeKeypoints(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.keypoints)) return payload.keypoints;
  return [];
}

function tryParseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  const candidates = extractJsonCandidates(raw);
  for (const item of candidates) {
    try {
      return JSON.parse(item);
    } catch {
      // continue
    }
  }
  return null;
}

function extractJsonCandidates(text) {
  const results = [];
  const starts = ['{', '['];
  for (let i = 0; i < text.length; i += 1) {
    if (!starts.includes(text[i])) continue;
    const end = findJsonEnd(text, i);
    if (end > i) {
      results.push(text.slice(i, end + 1));
    }
  }
  return results;
}

function findJsonEnd(text, start) {
  let stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1];
      if (!top) return -1;
      if ((top === '{' && ch !== '}') || (top === '[' && ch !== ']')) {
        return -1;
      }
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function buildSegmentPrompt({
  segmentText,
  startTime,
  endTime,
  targetPoints,
  densityHint,
  segmentIndex,
  totalSegments,
}) {
  return `你是“视频知识点提炼专家”，请对以下第 ${segmentIndex}/${totalSegments} 个时间片做深度分析。

目标：
1) 识别“信息密集片段”与“信息稀疏片段”，密集处可多提，稀疏处可少提。
2) 提炼具有学习价值或决策价值的知识点，而不是泛泛复述。
3) 覆盖该时间片内不同主题，避免同义重复。

时间片信息：
- 起始时间: ${startTime}s
- 结束时间: ${endTime}s
- 建议提炼数量: ${targetPoints}
- 信息密度提示: ${densityHint}

输出规则（必须严格遵守）：
- 只输出 JSON 对象，不要输出其他文字。
- 格式：
{
  "keypoints": [
    {
      "time": "mm:ss",
      "title": "主题化标题（12-24字）",
      "description": "2-4句解释：结论+依据+适用条件/限制",
      "evidence": "可定位到该片段的关键原话或事实摘要（非逐字抄）",
      "importance": 1-5
    }
  ]
}
- time 必须落在该时间片范围内。
- 如果该片段确实没有有价值信息，可以返回空数组：{"keypoints":[]}

待分析文本：
${String(segmentText || '').slice(0, 5500)}`;
}

function buildConsolidatePrompt({ fullText, candidateKeypoints, numPoints }) {
  return `你是资深课程内容编辑，请将候选知识点做“去重、纠偏、重排”，输出最终版本。

目标：
1) 选出 ${numPoints} 条最有价值知识点（允许少于该数量，但不要水）。
2) 保证时间分布合理：不要都集中在开头。
3) 同一主题只保留一条最完整版本。
4) 描述要“可执行、可理解”，避免空话。

输出规则：
- 仅输出 JSON：
{
  "keypoints":[
    {"time":"mm:ss","title":"...","description":"...","importance":1-5}
  ]
}
- 按时间升序排列。
- 不要输出 markdown，不要输出解释文字。

候选知识点：
${JSON.stringify(candidateKeypoints).slice(0, 12000)}

原始全文参考（节选）：
${String(fullText || '').slice(0, 9000)}`;
}

function normalizeDescription(item) {
  const base = String(item?.description || '').trim();
  const evidence = String(item?.evidence || '').trim();
  if (base) return base;
  return evidence;
}

export class MinimaxProvider {
  constructor(apiKey, baseUrl = 'https://api.minimax.io', preferredModel = 'MiniMax-M2.7') {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = apiKey;
    this.preferredModel = preferredModel;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  async generate(subtitle, numPoints) {
    const prompt = buildConsolidatePrompt({
      fullText: subtitle,
      candidateKeypoints: [],
      numPoints,
    });

    const response = await this.requestChatCompletion([{ role: 'user', content: prompt }], 0.2);
    const raw = extractResponseText(response?.data);
    const parsed = tryParseJson(raw);
    const keypoints = normalizeKeypoints(parsed);
    return keypoints.map((kp) => ({
      ...kp,
      description: normalizeDescription(kp),
    }));
  }

  async analyzeSegment(params) {
    const prompt = buildSegmentPrompt(params);
    try {
      const response = await this.requestChatCompletion([{ role: 'user', content: prompt }], 0.2);
      const raw = extractResponseText(response?.data);
      const parsed = tryParseJson(raw);
      const keypoints = normalizeKeypoints(parsed);
      return keypoints.map((kp) => ({
        ...kp,
        description: normalizeDescription(kp),
      }));
    } catch (e) {
      console.error('MiniMax analyzeSegment failed:', e.message);
      if (isAuthError(e)) throw e;
      return [];
    }
  }

  async consolidateKeypoints(fullText, candidateKeypoints, numPoints) {
    if (!Array.isArray(candidateKeypoints) || candidateKeypoints.length === 0) return [];

    const prompt = buildConsolidatePrompt({ fullText, candidateKeypoints, numPoints });

    try {
      const response = await this.requestChatCompletion([{ role: 'user', content: prompt }], 0.1);
      const raw = extractResponseText(response?.data);
      const parsed = tryParseJson(raw);
      const result = normalizeKeypoints(parsed);
      return result.map((kp) => ({
        ...kp,
        description: normalizeDescription(kp),
      }));
    } catch (e) {
      console.error('MiniMax consolidateKeypoints failed:', e.message);
      if (isAuthError(e)) throw e;
      return [];
    }
  }

  async requestChatCompletion(messages, temperature) {
    const endpointCandidates = ['/v1/text/chatcompletion_v2', '/v1/chat/completions', '/v1/text/chatcompletion'];
    const modelCandidates = [
      this.preferredModel,
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.1',
      'MiniMax-M2',
    ];

    let lastError = null;
    for (const path of endpointCandidates) {
      for (const model of modelCandidates) {
        try {
          const response = await this.client.post(path, {
            model,
            messages,
            temperature,
          });
          const statusCode = response?.data?.base_resp?.status_code;
          if (statusCode == null || statusCode === 0) {
            return response;
          }
          lastError = new Error(response?.data?.base_resp?.status_msg || `status_code=${statusCode}`);
        } catch (e) {
          lastError = e;
        }
      }
    }
    throw lastError || new Error('MiniMax request failed');
  }
}

function isAuthError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('invalid api key') || msg.includes('unauthorized') || msg.includes('forbidden');
}

function extractResponseText(data) {
  if (!data) return '';
  const choiceText = data?.choices?.[0]?.message?.content;
  if (choiceText) return choiceText;
  if (typeof data.reply === 'string' && data.reply) return data.reply;
  return '';
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return 'https://api.minimax.io';
  if (raw.includes('api.minimax.chat')) {
    return raw.replace('api.minimax.chat', 'api.minimax.io');
  }
  return raw;
}
