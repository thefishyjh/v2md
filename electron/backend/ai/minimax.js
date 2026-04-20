import axios from 'axios';

export class MinimaxProvider {
  constructor(apiKey, baseUrl = 'https://api.minimax.chat') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  }

  async generate(subtitle, numPoints) {
    const response = await this.client.post('/v1/text/chatcompletion', {
      model: 'minimax-01',
      messages: [{ role: 'user', content: `分析字幕提取${numPoints}个关键点` }],
    });
    return JSON.parse(response.data.choices[0].message.content);
  }

  async analyzeSegment(segmentText, startTime, numPoints) {
    const prompt = `你是一个视频内容分析助手。分析以下视频字幕/转写文本片段，提取最重要的知识内容点。

要求：
1. 提取 ${numPoints} 个最有关代表性的关键知识点
2. 每个关键点包含：时间戳（秒）、标题（简短，不超过20字）、描述（1-2句话）
3. 选择真正有信息价值、能帮助理解视频核心内容的时刻
4. 对于知识科普类视频，要区分：定义、原理、例子、结论
5. 时间戳基于视频开始时间 ${startTime} 秒

字幕/转写内容：
${segmentText.substring(0, 4000)}

请以JSON格式返回，格式如下：
{
  "keypoints": [
    { "time": "30", "title": "关键点标题", "description": "简短描述" }
  ]
}`;

    try {
      const response = await this.client.post('/v1/text/chatcompletion', {
        model: 'minimax-01',
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse MiniMax response');
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.keypoints || [];
    } catch (e) {
      console.error('MiniMax analyzeSegment failed:', e.message);
      return [];
    }
  }
}