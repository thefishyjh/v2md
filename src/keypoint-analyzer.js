import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';

const anthropic = new Anthropic();

export async function keypointAnalyzer(subtitlePath, numPoints = 8) {
  // If no subtitle, generate from description or return empty
  if (!subtitlePath) {
    console.log('  无字幕内容，跳过关键点分析');
    return [];
  }

  // Read subtitle file
  const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
  const subtitleText = parseSubtitle(subtitleContent);

  if (!subtitleText.trim()) {
    console.log('  字幕内容为空，跳过关键点分析');
    return [];
  }

  console.log(`  字幕长度: ${subtitleText.length} 字符`);

  // Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `你是一个视频内容分析助手。我会给你一段视频字幕，请你分析并提取出最重要的关键内容点。

要求：
1. 提取 ${numPoints} 个最有关代表性的关键点
2. 每个关键点包含：时间戳（mm:ss格式）、标题（简短，不超过20字）、描述（1-2句话）
3. 选择真正有信息价值、能帮助理解视频核心内容的时刻
4. 忽略重复的废话和无意义内容

字幕内容：
${subtitleText}

请以JSON格式返回，格式如下：
{
  "keypoints": [
    { "time": "02:30", "title": "关键点标题", "description": "简短描述" }
  ]
}`,
    }],
  });

  const responseText = response.content[0].text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('AI返回格式错误，无法解析关键点');
  }

  const result = JSON.parse(jsonMatch[0]);
  return result.keypoints || [];
}

function parseSubtitle(content) {
  // Parse SRT format and extract text
  // SRT format:
  // 1
  // 00:00:00,000 --> 00:00:02,000
  // Subtitle text
  //
  const lines = content.split('\n');
  const textLines = [];
  let capturing = false;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      // Sequence number
      capturing = true;
      currentText = [];
    } else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // Timestamp line
      capturing = false;
    } else if (trimmed === '') {
      // Empty line - end of subtitle block
      if (capturing && currentText.length > 0) {
        textLines.push(currentText.join(' ').trim());
      }
      capturing = false;
    } else if (capturing) {
      // Subtitle text
      currentText.push(trimmed);
    }
  }

  return textLines.join('\n');
}
