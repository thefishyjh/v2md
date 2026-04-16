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
}