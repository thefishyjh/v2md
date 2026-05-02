import 'dotenv/config';
import { parseArgs } from 'util';
import { videoFetcher } from './video-fetcher.js';
import { keypointAnalyzer } from './keypoint-analyzer.js';
import { screenshotExtractor } from './screenshot-extractor.js';
import { markdownGenerator } from './markdown-generator.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o', default: '.' },
    'num-points': { type: 'string', short: 'n', default: '8' },
    'time-offset': { type: 'string', short: 't', default: '0' },
    'no-screenshots': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (values.help || positionals.length === 0) {
  console.log(`
v2md - B站视频转Markdown笔记

用法:
  v2md <url> [选项]

选项:
  -o, --output <目录>      输出目录 (默认: 当前目录)
  -n, --num-points <数量>  关键点数量 (默认: 8)
  -t, --time-offset <偏移> 截屏时间偏移，如 +1s (默认: 0)
  --no-screenshots         仅生成文字笔记，不截屏
  -h, --help               显示帮助信息

示例:
  v2md "https://bilibili.com/video/BVxxxxx" -o ./output -n 8
  `);
  process.exit(0);
}

const url = positionals[0];
const outputDir = values.output;
const numPoints = parseInt(values['num-points'], 10);
const timeOffset = values['time-offset'];
const noScreenshots = values['no-screenshots'];

async function main() {
  console.log('开始处理视频...');
  console.log(`URL: ${url}`);

  // Step 1: 获取视频信息和字幕
  console.log('\n[1/4] 获取视频信息...');
  const { metadata, subtitlePath, transcription } = await videoFetcher(url);

  // Step 2: 分析关键点
  console.log('\n[2/4] 分析关键内容点...');
  const keypoints = await keypointAnalyzer(subtitlePath, numPoints, transcription);

  // Step 3: 截取关键帧
  let screenshotPaths = [];
  if (!noScreenshots) {
    console.log('\n[3/4] 截取关键帧...');
    screenshotPaths = await screenshotExtractor(metadata.videoPath, keypoints, outputDir, timeOffset);
  }

  // Step 4: 生成 Markdown
  console.log('\n[4/4] 生成Markdown笔记...');
  const outputPath = await markdownGenerator(metadata, keypoints, screenshotPaths, outputDir, {
    subtitlePath,
    transcription,
  });

  console.log(`\n完成! 笔记已保存到: ${outputPath}`);
}

main().catch((err) => {
  console.error('错误:', err.message);
  process.exit(1);
});
