import axios from 'axios';

export class DeepSeekProvider {
  constructor(apiKey) {
    this.client = axios.create({
      baseURL: 'https://api.deepseek.com',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  }

  async generate(subtitle, numPoints) {
    const response = await this.client.post('/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `分析字幕提取${numPoints}个关键点` }],
    });
    return JSON.parse(response.data.choices[0].message.content);
  }
}