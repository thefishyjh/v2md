# v2md

> 将 B站（Bilibili）视频转化为包含关键内容点和关键帧截图的 Markdown 笔记

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## 功能特性

- 📥 **自动下载** - 解析 B站视频信息，获取字幕
- 🤖 **AI 智能分析** - 调用 Claude AI 分析字幕，提取关键内容点
- 📸 **关键帧截屏** - 在关键时间点自动截取截图
- 📝 **Markdown 输出** - 生成结构化的笔记文件

## 效果示例

输入 B站视频链接，自动生成如下格式的笔记：

```markdown
# 【合集】清华大学计算机组成原理 P1-P10

## 视频信息

- **UP主**: 清华大学
- **时长**: 45:30
- **链接**: [https://bilibili.com/video/BV1xx411c7XZ](https://bilibili.com/video/BV1xx411c7XZ)
- **发布日期**: 2024-01-15

## 关键内容点

### [02:30] 计算机组成原理概述
介绍了计算机硬件系统的主要组成部分...

![截图](screenshots/screenshot-1.png)

### [15:45] 指令系统体系结构
讲解了RISC和CISC两种指令集的区别...

![截图](screenshots/screenshot-2.png)
```

## 安装

### 前提依赖

- **Node.js** >= 18.0.0
- **yt-dlp** - 视频/字幕下载（命令行工具）
- **ffmpeg** - 用于截取关键帧

安装 yt-dlp 和 ffmpeg：

```bash
# Windows (scoop)
scoop install yt-dlp ffmpeg

# macOS
brew install yt-dlp ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install yt-dlp ffmpeg
```

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/thefishyjh/v2md.git
cd v2md

# 安装依赖
npm install

# 复制配置文件
cp .env.example .env
```

### 配置 API Key

编辑 `.env` 文件，填入你的 Anthropic API Key：

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

> 💡 获取 API Key: [Anthropic Console](https://console.anthropic.com/)

## 使用

### 基本用法

```bash
node bin/cli.js "https://bilibili.com/video/BVxxxxx"
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `url` | B站视频链接 | 必需 |
| `-o, --output` | 输出目录 | 当前目录 |
| `-n, --num-points` | 关键点数量 | 8 |
| `-t, --time-offset` | 截屏时间偏移 | 0 |
| `--no-screenshots` | 仅生成文字笔记 | false |
| `-h, --help` | 显示帮助 | - |

### 示例

```bash
# 基本使用
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ"

# 指定输出目录
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ" -o ./output

# 提取更多关键点
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ" -n 12

# 截屏偏移（关键点后1秒截屏）
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ" -t +1s

# 不截屏（更快，仅生成文字）
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ" --no-screenshots

# 组合使用
node bin/cli.js "https://bilibili.com/video/BV1xx411c7XZ" -o ./notes -n 10 -t +0.5s
```

### 输出文件

运行后会在指定目录生成：

```
output/
├── 视频标题.md          # Markdown 笔记
└── screenshots/        # 截图文件夹
    ├── screenshot-1.png
    ├── screenshot-2.png
    └── ...
```

## 工作原理

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  输入 URL   │───▶│  yt-dlp 下载    │───▶│  视频元数据       │
└─────────────┘    │  视频 + 字幕     │    │  字幕文件         │
                    └─────────────────┘    └──────────────────┘
                                                 │
                                                 ▼
                    ┌─────────────────┐    ┌──────────────────┐
                    │  ffmpeg 截屏     │◀───│  Claude AI       │
                    │  关键帧提取      │    │  分析关键点      │
                    └─────────────────┘    └──────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  Markdown 笔记   │
                                        │  + 截图          │
                                        └──────────────────┘
```

## 项目结构

```
v2md/
├── bin/
│   └── cli.js                 # 命令行入口
├── src/
│   ├── index.js               # 主协调器
│   ├── video-fetcher.js       # 视频/字幕下载
│   ├── keypoint-analyzer.js   # AI 关键点分析
│   ├── screenshot-extractor.js # 关键帧截屏
│   └── markdown-generator.js  # Markdown 生成
├── .env.example               # 环境变量示例
├── package.json
└── README.md
```

## 技术栈

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 视频信息获取与下载
- [ffmpeg](https://ffmpeg.org/) - 音视频处理与截屏
- [Anthropic Claude API](https://www.anthropic.com/) - AI 关键点分析
- [Node.js](https://nodejs.org/) - 运行环境

## 常见问题

### Q: 提示 "无法下载字幕"
A: 部分 B站视频没有字幕（用户未上传或关闭），可使用 `--no-screenshots` 参数仅生成文字笔记

### Q: 提示 "ffmpeg 未安装"
A: 请安装 ffmpeg 并确保其在 PATH 环境变量中

### Q: 截屏时间不准确
A: 使用 `-t` 参数调整偏移，如 `-t +1s` 表示在关键点后 1 秒截屏

### Q: 视频下载失败
A: 可能是网络问题或视频已下架/私密化，请检查视频链接是否有效

## License

MIT License - see [LICENSE](LICENSE) for details.

## Star History

如果这个项目对你有帮助，欢迎 star ⭐

[![Star History](https://api.star-history.com/svg?repos=thefishyjh/v2md&type=Timeline)](https://star-history.com/#thefishyjh/v2md&Timeline)
