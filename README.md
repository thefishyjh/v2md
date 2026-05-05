# v2md

> 将 Bilibili 视频转换为带关键内容点、关键帧截图和结构化素材的 Markdown 笔记。

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Electron](https://img.shields.io/badge/Electron-28-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

v2md 是一个桌面端视频笔记工具。输入 B 站视频链接、BV 号或 av 号后，它会获取视频信息和字幕，必要时使用 whisper.cpp 做本地转写，再调用 AI 提炼关键内容点，最后按关键时间点截取画面并生成 Markdown 笔记。

## 功能特性

- B 站视频解析：支持 `bilibili.com`、`b23.tv`、`BV...`、`av...` 输入。
- AI 关键点分析：支持 Claude、Minimax、DeepSeek。
- 字幕优先，转写兜底：优先使用视频字幕；无字幕时可调用 whisper.cpp 本地转写。
- 关键帧截图：使用 ffmpeg 按关键内容点自动截取画面。
- Markdown 输出：生成 `notes.md`，并保存截图、元数据、关键点 JSON、字幕或转写结果。
- 桌面工作台：左侧历史记录，中间编辑/预览/分栏，右侧摘要与截图预览。
- 本地配置：在设置面板中保存 API Key、B 站 Cookie、输出目录和 whisper.cpp 路径。
- 任务控制：处理过程显示进度，并支持取消当前任务。

## 快速开始

### 环境要求

- Node.js >= 18
- npm
- yt-dlp
- ffmpeg

安装 yt-dlp 和 ffmpeg：

```bash
# Windows (scoop)
scoop install yt-dlp ffmpeg

# macOS
brew install yt-dlp ffmpeg

# Ubuntu/Debian
sudo apt install yt-dlp ffmpeg
```

### 安装依赖

```bash
git clone https://github.com/thefishyjh/v2md.git
cd v2md
npm install
```

### 启动桌面端

开发模式：

```bash
npm run electron:dev
```

构建前端：

```bash
npm run build
```

打包 Windows 安装包：

```bash
npm run package
```

打包产物会输出到 `release/`。

## 桌面端使用

1. 运行 `npm run electron:dev` 打开应用。
2. 点击右下角的“设置”。
3. 填入至少一个 AI Provider 的 API Key：
   - Claude：`anthropicApiKey`
   - Minimax：`minimaxApiKey`，可配置 Base URL 和模型名
   - DeepSeek：`deepseekApiKey`
4. 如遇 B 站 412、登录态或权限问题，粘贴完整 B 站 Cookie。
5. 如视频没有字幕，配置 whisper.cpp 可执行文件路径和模型文件。
6. 在底部输入框粘贴 B 站链接、BV 号或 av 号。
7. 选择模型和关键点数量，点击“开始”。

生成完成后，历史记录会自动刷新。选择历史记录后，可以在中间面板编辑或预览 Markdown，在右侧查看视频摘要、关键点和截图。

## 设置说明

设置保存在本地应用存储中，不需要手动编辑 `.env`。

| 配置项 | 说明 |
| --- | --- |
| Claude API Key | Claude 模型调用凭证 |
| Minimax API Key | Minimax 模型调用凭证，设置页支持验证 |
| Minimax Base URL | 默认 `https://api.minimax.io` |
| Minimax Model | 默认 `MiniMax-M2.7` |
| DeepSeek API Key | DeepSeek 模型调用凭证 |
| B 站完整 Cookie | 用于通过 B 站登录态、风控或 412 鉴权 |
| 输出目录 | 默认 `./output` |
| whisper.cpp 可执行文件路径 | 可选；为空时会自动查找常见路径 |

获取 B 站 Cookie 的常见方式：

1. 浏览器登录 B 站。
2. 打开开发者工具的 Network 面板。
3. 访问任意视频接口请求。
4. 在 Request Headers 中复制完整 `Cookie`。
5. 粘贴到 v2md 设置页。

## whisper.cpp 兜底转写

当视频没有字幕时，v2md 会尝试下载音频并调用 whisper.cpp 转写。你需要准备：

- `whisper-cli.exe` 或 PATH 中可访问的 `whisper-cli`
- `ggml-small.bin` 模型文件

默认查找位置包括：

```text
whisper.cpp/build/bin/whisper-cli.exe
whisper.cpp/whisper-cli.exe
whisper-cli.exe
bin/whisper-cli.exe
```

模型默认查找位置包括：

```text
whisper.cpp/models/ggml-small.bin
models/ggml-small.bin
```

也可以通过环境变量指定模型：

```bash
V2MD_WHISPER_MODEL=/path/to/ggml-small.bin
```

转写缓存保存在：

```text
.appdata/transcriptions/
```

## 命令行使用

项目仍保留 CLI 入口：

```bash
node bin/cli.js "https://www.bilibili.com/video/BVxxxxx"
```

参数：

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `url` | B 站视频链接 | 必填 |
| `-o, --output` | 输出目录 | 当前目录 |
| `-n, --num-points` | 关键点数量 | `8` |
| `-t, --time-offset` | 截图时间偏移，例如 `+1s` | `0` |
| `--no-screenshots` | 仅生成文字笔记，不截图 | `false` |
| `-h, --help` | 显示帮助 | - |

示例：

```bash
# 基本使用
node bin/cli.js "https://www.bilibili.com/video/BV1xx411c7XZ"

# 指定输出目录
node bin/cli.js "https://www.bilibili.com/video/BV1xx411c7XZ" -o ./output

# 提取更多关键点
node bin/cli.js "https://www.bilibili.com/video/BV1xx411c7XZ" -n 12

# 仅生成文字笔记
node bin/cli.js "https://www.bilibili.com/video/BV1xx411c7XZ" --no-screenshots
```

注意：桌面端支持本地设置里的多模型配置；CLI 仍主要沿用环境变量和默认流程，更推荐使用桌面端。

## 输出结构

每个视频会在输出目录下生成一个以视频标题命名的文件夹：

```text
output/
└── 视频标题/
    ├── notes.md
    ├── metadata.json
    ├── keypoints.json
    ├── transcription.json
    ├── subtitles/
    │   └── subtitle.srt
    └── screenshots/
        ├── screenshot-1.png
        ├── screenshot-2.png
        └── ...
```

其中 `transcription.json` 只会在使用 whisper.cpp 转写时生成；`subtitles/` 只会在成功下载字幕时生成。

## 工作流程

```text
输入 B 站链接 / BV / av
        |
        v
yt-dlp 获取视频元数据
        |
        v
优先下载字幕，失败则下载音频并用 whisper.cpp 转写
        |
        v
AI 分析字幕或转写文本，提炼关键内容点
        |
        v
ffmpeg 按关键时间点截图
        |
        v
生成 notes.md、截图、metadata、keypoints 等文件
        |
        v
写入本地历史记录并在桌面端展示
```

## 项目结构

```text
v2md/
├── bin/
│   └── cli.js
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── backend/
│       ├── server.js
│       ├── cookie-manager.js
│       └── ai/
│           ├── anthropic.js
│           ├── deepseek.js
│           ├── index.js
│           └── minimax.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.js
│   ├── video-fetcher.js
│   ├── transcription-manager.js
│   ├── keypoint-analyzer.js
│   ├── screenshot-extractor.js
│   ├── markdown-generator.js
│   ├── components/
│   └── store/
├── public/
├── docs/
├── package.json
└── README.md
```

## 技术栈

- Electron：桌面应用壳与本地能力
- React + Vite：前端界面
- Tailwind CSS：界面样式
- yt-dlp：视频元数据、字幕、音视频下载
- ffmpeg：音频转换与关键帧截图
- whisper.cpp：本地语音转写兜底
- Anthropic / Minimax / DeepSeek：AI 关键点分析
- marked：Markdown 预览渲染
- electron-store：本地设置与历史记录

## 常见问题

### 提示无法获取视频信息

请确认 yt-dlp 已安装并在 PATH 中；如果视频需要登录态或触发 B 站风控，请在设置中粘贴完整 B 站 Cookie。

### 视频没有字幕怎么办

配置 whisper.cpp 和 `ggml-small.bin` 模型后，v2md 会自动下载音频并尝试本地转写。

### 提示找不到 ffmpeg

安装 ffmpeg 并确认命令行中可以直接运行：

```bash
ffmpeg -version
```

### AI 模型提示 Unknown model

当前选择的模型没有配置 API Key。打开设置页，填入对应 Provider 的 API Key 后保存。

### 生成的历史记录打不开

历史记录保存的是本地文件路径。请确认输出目录中的视频文件夹、`notes.md` 和截图没有被移动或删除。

## License

MIT License - see [LICENSE](LICENSE) for details.
