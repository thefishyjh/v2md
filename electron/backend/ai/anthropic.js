import Anthropic from '@anthropic-ai/sdk';

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
        content: `你是一个视频内容分析助手。分析字幕提取${numPoints}个关键点，返回JSON格式。`,
      }],
    });
    return JSON.parse(response.content[0].text);
  }
}