# v2md UI Improvements & Technical Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve v2md Electron UI with Cookie input, organized output, Whisper transcription for subtitle-free videos, and dynamic knowledge point extraction

**Architecture:**
1. Add Bilibili Cookie input to SettingsModal
2. Restructure output to organized folder format
3. Add local Whisper.cpp transcription for videos without subtitles
4. Use MiniMax M2.7 for dynamic knowledge point extraction (segment-based)
5. Enhance Toolbar with progress display and validation

**Tech Stack:** React, Electron, electron-store, Tailwind CSS, Whisper.cpp (local), MiniMax M2.7 API

---

## Complete Technical Flow

```
B站视频 URL
      │
      ▼
┌─────────────────────────────────────┐
│  Step 1: 检查字幕                    │
│  ├─ 有字幕 → 直接跳转 Step 4         │
│  └─ 无字幕 → 继续 Step 2             │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 2: 音频转写（本地 Whisper.cpp）│
│  ├─ 下载音频 (yt-dlp)               │
│  ├─ 按 5分钟 分段                   │
│  ├─ 本地 Whisper.cpp 转写           │
│  └─ 保存转写文本到本地缓存           │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 3: 大模型分析 (MiniMax M2.7)  │
│  ├─ 输入: 字幕文本 / 转写文本        │
│  ├─ 方式: 分段分析 + 合并去重        │
│  └─ 输出: 所有知识点（不遗漏）       │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 4: 关键帧截取 + 笔记生成       │
└─────────────────────────────────────┘
```

---

## Output Structure

```
output/
└── 视频标题/
    ├── notes.md           # 笔记正文
    ├── metadata.json      # 视频元数据
    ├── keypoints.json     # 所有知识点
    ├── transcription.json  # 转写文本（如果有）
    ├── subtitles/        # 字幕文件夹
    │   └── zh-CN.srt
    └── screenshots/     # 截图文件夹
        ├── screenshot-1.png
        └── ...
```

---

## File Structure Changes

```
src/
├── components/
│   ├── SettingsModal.jsx    # Enhanced with Cookie + Output Dir
│   ├── Toolbar.jsx          # Enhanced with progress + validation
│   └── ...
├── video-fetcher.js         # Accept cookies, handle no-subtitle
├── keypoint-analyzer.js     # Segment-based analysis with MiniMax
├── transcription-manager.js # NEW: Local Whisper.cpp integration
└── markdown-generator.js   # Organized output structure

electron/
├── backend/
│   ├── server.js            # IPC handlers
│   ├── cookie-manager.js    # Cookie file management
│   └── ai/
│       ├── minimax.js       # Already exists
│       └── index.js
└── main.js

bin/
└── whisper-install.js       # NEW: Whisper.cpp installer helper
```

---

## Task 1: Update SettingsModal - Add Cookie & Output Directory Input

**Files:**
- Modify: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Update settings state with new fields**

```javascript
const [settings, setSettings] = useState({
  anthropicApiKey: '',
  minimaxApiKey: '',
  minimaxBaseUrl: 'https://api.minimax.chat',
  deepseekApiKey: '',
  bilibiliCookie: '',  // NEW
  outputDir: './output',  // NEW - user selectable
  whisperPath: '',  // NEW - path to local whisper.cpp
});
```

- [ ] **Step 2: Add Cookie input field**

Add after line 54 (DeepSeek API Key section):

```jsx
<div>
  <label className="block text-sm font-medium mb-1">
    B站 Cookie (用于下载字幕)
  </label>
  <textarea
    value={settings.bilibiliCookie}
    onChange={(e) => setSettings({ ...settings, bilibiliCookie: e.target.value })}
    className="w-full px-3 py-2 border rounded font-mono text-xs"
    rows={3}
    placeholder="粘贴 B站 Cookie (SESSDATA 等)"
  />
  <p className="text-xs text-gray-500 mt-1">
    获取方法：登录 B站后，F12 → Application → Cookies → 复制 SESSDATA 值
  </p>
</div>
```

- [ ] **Step 3: Add Output Directory selector**

Add after Cookie input:

```jsx
<div>
  <label className="block text-sm font-medium mb-1">输出目录</label>
  <div className="flex gap-2">
    <input
      type="text"
      value={settings.outputDir}
      onChange={(e) => setSettings({ ...settings, outputDir: e.target.value })}
      className="flex-1 px-3 py-2 border rounded"
      placeholder="./output"
    />
    <button
      onClick={() => {
        window.electronAPI.selectDirectory().then(dir => {
          if (dir) setSettings({ ...settings, outputDir: dir });
        });
      }}
      className="px-3 py-2 border rounded hover:bg-gray-50"
    >
      选择
    </button>
  </div>
</div>
```

- [ ] **Step 4: Add Whisper path selector (optional)**

Add after Output Directory:

```jsx
<div>
  <label className="block text-sm font-medium mb-1">
    Whisper.cpp 路径 (可选，用于无字幕视频转写)
  </label>
  <div className="flex gap-2">
    <input
      type="text"
      value={settings.whisperPath}
      onChange={(e) => setSettings({ ...settings, whisperPath: e.target.value })}
      className="flex-1 px-3 py-2 border rounded"
      placeholder="留空则使用系统 whisper"
    />
    <button
      onClick={() => {
        window.electronAPI.selectFile(['exe', 'bin', 'sh']).then(file => {
          if (file) setSettings({ ...settings, whisperPath: file });
        });
      }}
      className="px-3 py-2 border rounded hover:bg-gray-50"
    >
      选择
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-1">
    下载地址: https://github.com/ggerganov/whisper.cpp
  </p>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.jsx
git commit -m "feat: add Cookie, Output Dir, Whisper path inputs to SettingsModal"
```

---

## Task 2: Create Cookie Manager Utility

**Files:**
- Create: `electron/backend/cookie-manager.js`

- [ ] **Step 1: Create cookie-manager.js**

```javascript
import fs from 'fs';
import path from 'path';
import os from 'os';

const COOKIE_FILE = 'bilibili_cookies.txt';

export function saveCookie(cookie) {
  if (!cookie) return null;
  const cookieDir = path.join(os.homedir(), '.v2md');
  const cookiePath = path.join(cookieDir, COOKIE_FILE);
  try {
    fs.mkdirSync(cookieDir, { recursive: true });
    // Convert SESSDATA to Netscape format
    const lines = [
      '# Netscape HTTP Cookie File',
      `.bilibili.com\tTRUE\t/\tFALSE\t1791092502\tSESSDATA\t${cookie}`
    ];
    fs.writeFileSync(cookiePath, lines.join('\n'), 'utf-8');
    return cookiePath;
  } catch (e) {
    console.error('Failed to save cookie:', e.message);
    return null;
  }
}

export function getCookiePath() {
  const cookiePath = path.join(os.homedir(), '.v2md', COOKIE_FILE);
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

export function clearCookie() {
  const cookiePath = path.join(os.homedir(), '.v2md', COOKIE_FILE);
  if (fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/backend/cookie-manager.js
git commit -m "feat: add cookie management utility"
```

---

## Task 3: Create Transcription Manager (Whisper.cpp Integration)

**Files:**
- Create: `src/transcription-manager.js`

- [ ] **Step 1: Create transcription-manager.js**

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const TRANSCRIPTION_CACHE_DIR = path.join(os.homedir(), '.v2md', 'transcriptions');

export async function getTranscription(videoPath, videoId, whisperPath = '') {
  // Check cache first
  const cachePath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.json`);
  if (await fileExists(cachePath)) {
    const cached = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(cached);
  }

  // Determine whisper command
  const whisperCmd = whisperPath || 'whisper';
  const outputPath = path.join(TRANSCRIPTION_CACHE_DIR, videoId);

  try {
    await fs.mkdir(TRANSCRIPTION_CACHE_DIR, { recursive: true });

    // Run whisper.cpp for transcription
    // whisper.cpp usage: whisper -m model.bin -f audio.mp3 -osrt -of output
    const cmd = `${whisperCmd} -m model.bin -f "${videoPath}" -osrt -of "${outputPath}" --language zh`;
    await execAsync(cmd, { timeout: 600000 }); // 10 min timeout

    // Read generated SRT file
    const srtPath = `${outputPath}.srt`;
    if (await fileExists(srtPath)) {
      const srtContent = await fs.readFile(srtPath, 'utf-8');
      const transcription = parseSRT(srtContent);

      // Cache the result
      await fs.writeFile(cachePath, JSON.stringify(transcription), 'utf-8');

      return transcription;
    }

    return null;
  } catch (e) {
    console.error('Whisper transcription failed:', e.message);
    return null;
  }
}

function parseSRT(content) {
  const lines = content.split('\n');
  const segments = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Sequence number
    if (/^\d+$/.test(trimmed)) {
      if (current) segments.push(current);
      current = { text: '' };
    }
    // Timestamp line - skip
    else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // do nothing
    }
    // Empty line
    else if (trimmed === '') {
      if (current && current.text) {
        segments.push(current);
        current = null;
      }
    }
    // Text content
    else if (current) {
      current.text += (current.text ? ' ' : '') + trimmed;
    }
  }

  if (current && current.text) {
    segments.push(current);
  }

  return segments;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function clearTranscriptionCache(videoId) {
  const cachePath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.json`);
  const srtPath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.srt`);

  try {
    if (await fileExists(cachePath)) await fs.unlink(cachePath);
    if (await fileExists(srtPath)) await fs.unlink(srtPath);
  } catch (e) {
    console.error('Failed to clear cache:', e.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/transcription-manager.js
git commit -m "feat: add Whisper.cpp transcription manager"
```

---

## Task 4: Update video-fetcher.js - Handle No-Subtitle Case

**Files:**
- Modify: `src/video-fetcher.js`

- [ ] **Step 1: Update function signature to accept options**

```javascript
export async function videoFetcher(url, options = {}) {
  const { cookiePath, whisperPath = '' } = options;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2md-'));
```

- [ ] **Step 2: Update getMetadata function**

```javascript
async function getMetadata(url, tempDir) {
  const outputFile = path.join(tempDir, 'metadata.json');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --dump-json --no-playlist "${url}" > "${outputFile}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --dump-json --no-playlist --cookies "${cookiePath}" "${url}" > "${outputFile}" 2>NUL`;
    }
    await execAsync(cmd);
    const content = await fs.readFile(outputFile, 'utf-8');
    const info = JSON.parse(content);

    return {
      id: info.id || extractVideoId(url),
      title: info.title || 'Unknown Title',
      uploader: info.uploader || info.channel || info.username || 'Unknown UP',
      duration: info.duration || 0,
      uploadDate: info.upload_date || '',
      thumbnail: info.thumbnail || '',
      description: info.description || '',
      webpageUrl: info.webpage_url || url,
      videoPath: '',
      hasSubtitle: !!(info.subtitles && Object.keys(info.subtitles).length > 0),
    };
  } catch (e) {
    throw new Error(`Failed to fetch metadata: ${e.message}`);
  }
}
```

- [ ] **Step 3: Update downloadSubtitle function**

```javascript
async function downloadSubtitle(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'subtitle.%(ext)s');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --write-sub --write-auto-sub --sub-lang zh-Hans,zh-CN,zh,en --sub-format srt --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --write-sub --write-auto-sub --sub-lang zh-Hans,zh-CN,zh,en --sub-format srt --no-playlist --cookies "${cookiePath}" -o "${outputTemplate}" "${url}" 2>NUL`;
    }
    await execAsync(cmd);

    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(f => f.startsWith('subtitle.') && f.endsWith('.srt'));
    if (subtitleFile) {
      return path.join(tempDir, subtitleFile);
    }
    return null;
  } catch (e) {
    console.log('  Warning: Cannot download subtitles');
    return null;
  }
}
```

- [ ] **Step 4: Update downloadVideo function**

```javascript
async function downloadVideo(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'video.%(ext)s');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp -f "bestvideo[ext=mp4]/best[ext=mp4]/best" --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp -f "bestvideo[ext=mp4]/best[ext=mp4]/best" --no-playlist --cookies "${cookiePath}" -o "${outputTemplate}" "${url}" 2>NUL`;
    }
    await execAsync(cmd);

    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.startsWith('video.'));
    if (videoFile) {
      return path.join(tempDir, videoFile);
    }
    return null;
  } catch (e) {
    console.log('  Warning: Cannot download video');
    return null;
  }
}
```

- [ ] **Step 5: Update main videoFetcher to handle no-subtitle case**

Replace the main `videoFetcher` function:

```javascript
export async function videoFetcher(url, options = {}) {
  const { cookiePath, whisperPath = '', onProgress } = options;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2md-'));

  // Step 1: Get metadata
  onProgress?.({ step: 1, message: '获取视频信息...' });
  const metadata = await getMetadata(url, tempDir);

  let subtitlePath = null;
  let transcription = null;

  // Step 2: Try to download subtitle, if fails use Whisper
  onProgress?.({ step: 2, message: '检查字幕...' });
  subtitlePath = await downloadSubtitle(url, tempDir, metadata.id);

  if (!subtitlePath) {
    // No subtitle - need to use Whisper for transcription
    onProgress?.({ step: 2, message: '无字幕，使用 Whisper 转写...' });

    // Download video first
    onProgress?.({ step: 2, message: '下载视频用于转写...' });
    const videoPath = await downloadVideo(url, tempDir, metadata.id);

    if (videoPath) {
      metadata.videoPath = videoPath;
      // Use Whisper to transcribe
      transcription = await getTranscription(videoPath, metadata.id, whisperPath);
    }
  }

  // Step 3: Download video for screenshots
  if (!metadata.videoPath) {
    onProgress?.({ step: 3, message: '下载视频用于截图...' });
    metadata.videoPath = await downloadVideo(url, tempDir, metadata.id);
  }

  return { metadata, subtitlePath, transcription };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/video-fetcher.js src/transcription-manager.js
git commit -m "feat: add Whisper transcription support for no-subtitle videos"
```

---

## Task 5: Update keypoint-analyzer.js - Segment-Based Analysis

**Files:**
- Modify: `src/keypoint-analyzer.js`

- [ ] **Step 1: Update imports and constants**

```javascript
import { MinimaxProvider } from '../electron/backend/ai/minimax.js';
import fs from 'fs/promises';

// Segment length in minutes
const SEGMENT_LENGTH_MINUTES = 5;
```

- [ ] **Step 2: Rewrite main function for segment-based analysis**

```javascript
export async function keypointAnalyzer(subtitlePath, numPoints = 8, transcription = null) {
  // If no subtitle AND no transcription, skip analysis
  if (!subtitlePath && !transcription) {
    console.log('  No subtitle or transcription, skipping keypoint analysis');
    return [];
  }

  // Get text content
  let fullText = '';
  if (subtitlePath) {
    const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
    fullText = parseSubtitle(subtitleContent);
  } else if (transcription) {
    fullText = transcription.map(s => s.text).join('\n');
  }

  if (!fullText.trim()) {
    console.log('  Content is empty, skipping analysis');
    return [];
  }

  console.log(`  Content length: ${fullText.length} chars`);

  // Initialize MiniMax provider
  const minimax = new MinimaxProvider(
    store.get('minimaxApiKey', ''),
    store.get('minimaxBaseUrl', 'https://api.minimax.chat')
  );

  // Split into segments for analysis
  const segments = splitIntoSegments(fullText, SEGMENT_LENGTH_MINUTES);
  console.log(`  Split into ${segments.length} segments`);

  // Analyze each segment and collect all keypoints
  const allKeypoints = [];
  for (let i = 0; i < segments.length; i++) {
    console.log(`  Analyzing segment ${i + 1}/${segments.length}...`);

    try {
      const segmentKeypoints = await minimax.analyzeSegment(
        segments[i],
        segments[i].startTime,
        Math.max(3, Math.floor(numPoints / segments.length) + 1)
      );
      allKeypoints.push(...segmentKeypoints);
    } catch (e) {
      console.error(`  Segment ${i + 1} analysis failed:`, e.message);
    }
  }

  // Deduplicate and merge keypoints
  const deduplicated = deduplicateKeypoints(allKeypoints);
  console.log(`  Total keypoints after dedup: ${deduplicated.length}`);

  return deduplicated;
}

function splitIntoSegments(text, segmentMinutes) {
  // Estimate time per character (average speech rate)
  const charsPerMinute = 300;
  const charsPerSegment = charsPerMinute * segmentMinutes;

  const segments = [];
  const lines = text.split('\n');
  let currentSegment = { text: '', startTime: 0 };
  let currentCharCount = 0;
  let segmentStartTime = 0;

  for (const line of lines) {
    currentSegment.text += (currentSegment.text ? '\n' : '') + line;
    currentCharCount += line.length;

    if (currentCharCount >= charsPerSegment) {
      currentSegment.endTime = segmentStartTime + segmentMinutes * 60;
      segments.push(currentSegment);
      segmentStartTime = currentSegment.endTime;
      currentSegment = { text: '', startTime: segmentStartTime };
      currentCharCount = 0;
    }
  }

  if (currentSegment.text) {
    segments.push(currentSegment);
  }

  return segments;
}

function deduplicateKeypoints(keypoints) {
  const seen = new Map();
  for (const kp of keypoints) {
    const key = kp.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, kp);
    }
  }
  return Array.from(seen.values());
}
```

- [ ] **Step 3: Add analyzeSegment method to MinimaxProvider**

Update `electron/backend/ai/minimax.js`:

```javascript
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
}
```

- [ ] **Step 4: Add store import to keypoint-analyzer.js**

```javascript
import Store from 'electron-store';
const store = new Store();
```

- [ ] **Step 5: Update parseSubtitle function**

```javascript
function parseSubtitle(content) {
  const lines = content.split('\n');
  const textLines = [];
  let inSubtitle = false;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      inSubtitle = true;
      currentText = [];
    }
    else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // do nothing, skip timestamp
    }
    else if (trimmed === '') {
      if (inSubtitle && currentText.length > 0) {
        textLines.push(currentText.join(' ').trim());
      }
      inSubtitle = false;
    }
    else if (inSubtitle) {
      currentText.push(trimmed);
    }
  }
  return textLines.join('\n');
}
```

- [ ] **Step 6: Commit**

```bash
git add src/keypoint-analyzer.js electron/backend/ai/minimax.js
git commit -m "feat: add segment-based keypoint analysis with MiniMax"
```

---

## Task 6: Update Toolbar - Add Progress Display and Validation

**Files:**
- Modify: `src/components/Toolbar.jsx`

- [ ] **Step 1: Add progress/error/success state**

```javascript
const [progress, setProgress] = useState(null);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
```

- [ ] **Step 2: Update handleStart with validation**

```javascript
async function handleStart() {
  // Validation
  if (!url.trim()) {
    setError('请输入视频链接');
    setTimeout(() => setError(null), 3000);
    return;
  }

  if (!url.includes('bilibili.com')) {
    setError('请输入有效的 B站 视频链接');
    setTimeout(() => setError(null), 3000);
    return;
  }

  setError(null);
  setSuccess(null);
  setLoading(true);
  setProgress({ step: 0, message: '开始处理...' });

  try {
    const result = await window.electronAPI.processVideo(url, { model, numPoints });
    if (result.success) {
      setProgress({ step: 4, message: '完成' });
      setSuccess(`笔记已生成：${result.outputPath}`);
      setTimeout(() => setSuccess(null), 8000);
    } else {
      setError(result.error || '处理失败');
      setProgress(null);
    }
  } catch (err) {
    setError(err.message);
    setProgress(null);
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 3: Add progress bar UI**

Add after the button section (before closing fragment):

```jsx
{/* Progress bar */}
{progress && (
  <div className="absolute bottom-full left-0 right-0 bg-white border-b shadow-lg p-3">
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium">{progress.message}</div>
        <div className="flex gap-1 mt-1">
          {[1, 2, 3, 4].map(step => (
            <div
              key={step}
              className={`h-2 flex-1 rounded ${
                step <= (progress.step || 0) ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
      {progress.step < 4 && (
        <button
          onClick={() => window.electronAPI.cancelProcess()}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          取消
        </button>
      )}
      {progress.step === 4 && (
        <button
          onClick={() => window.electronAPI.openFolder(result.outputPath)}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          打开文件夹
        </button>
      )}
    </div>
  </div>
)}

{/* Error message */}
{error && (
  <div className="absolute bottom-full left-0 right-0 bg-red-50 border-b border-red-200 p-3 text-red-600">
    {error}
  </div>
)}

{/* Success message */}
{success && (
  <div className="absolute bottom-full left-0 right-0 bg-green-50 border-b border-green-200 p-3 text-green-600">
    {success}
  </div>
)}
```

- [ ] **Step 4: Add relative positioning**

```jsx
<div className="bg-white border-t p-4 flex items-center gap-4 relative">
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.jsx
git commit -m "feat: add progress display and validation to Toolbar"
```

---

## Task 7: Organize Output Structure

**Files:**
- Modify: `src/markdown-generator.js`

- [ ] **Step 1: Replace with organized output structure**

```javascript
import fs from 'fs/promises';
import path from 'path';

export async function markdownGenerator(metadata, keypoints, screenshotPaths, outputDir) {
  // Create organized directory structure
  const safeTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  const videoDir = path.join(outputDir, safeTitle);
  const screenshotsDir = path.join(videoDir, 'screenshots');
  const subtitlesDir = path.join(videoDir, 'subtitles');

  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
  await fs.mkdir(subtitlesDir, { recursive: true });

  // Format duration
  const durationStr = formatDuration(metadata.duration);

  // Build markdown content
  let content = '';

  // Header
  content += `# ${metadata.title}\n\n`;

  // Metadata section
  content += `## 视频信息\n\n`;
  content += `- **UP主**: ${metadata.uploader}\n`;
  content += `- **时长**: ${durationStr}\n`;
  content += `- **链接**: [${metadata.webpageUrl}](${metadata.webpageUrl})\n`;
  if (metadata.uploadDate) {
    content += `- **发布日期**: ${formatDate(metadata.uploadDate)}\n`;
  }
  content += `- **知识点数量**: ${keypoints.length}\n`;

  content += '\n';

  // Key points section
  content += `## 关键内容点\n\n`;

  if (keypoints.length === 0) {
    content += `_暂无关键内容点_\n`;
  } else {
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      content += `### [${kp.time}] ${kp.title}\n\n`;
      content += `${kp.description || ''}\n\n`;

      // Screenshot reference (if available)
      const screenshotFile = `screenshot-${i + 1}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFile);
      if (screenshotPaths && screenshotPaths[i]) {
        try {
          await fs.copyFile(screenshotPaths[i], screenshotPath);
          content += `![截图](screenshots/${screenshotFile})\n\n`;
        } catch (e) {
          // Screenshot copy failed, skip
        }
      }
    }
  }

  // Write markdown file
  const mdPath = path.join(videoDir, 'notes.md');
  await fs.writeFile(mdPath, content, 'utf-8');

  // Save metadata as JSON
  const metadataPath = path.join(videoDir, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Save keypoints as JSON
  const keypointsPath = path.join(videoDir, 'keypoints.json');
  await fs.writeFile(keypointsPath, JSON.stringify(keypoints, null, 2), 'utf-8');

  return videoDir;
}

function formatDuration(seconds) {
  if (!seconds) return '未知';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/markdown-generator.js
git commit -m "feat: organize output into categorized folder structure"
```

---

## Task 8: Update server.js - Integrate All Components

**Files:**
- Modify: `electron/backend/server.js`

- [ ] **Step 1: Update imports and handlers**

```javascript
import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import { aiService } from './ai/index.js';
import { videoFetcher } from '../../src/video-fetcher.js';
import { screenshotExtractor } from '../../src/screenshot-extractor.js';
import { markdownGenerator } from '../../src/markdown-generator.js';
import { getCookiePath, saveCookie } from './cookie-manager.js';

const store = new Store();

// IPC: Select directory
ipcMain.handle('dialog:selectDirectory', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Select file
ipcMain.handle('dialog:selectFile', async (_, filters) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Open folder
ipcMain.handle('shell:openPath', (_, path) => {
  shell.openPath(path);
});

// IPC: Get settings
ipcMain.handle('settings:get', () => store.get('settings', {}));

// IPC: Save settings
ipcMain.handle('settings:save', (_, settings) => {
  store.set('settings', settings);
  aiService.init(settings);

  // Save Bilibili cookie if provided
  if (settings.bilibiliCookie) {
    saveCookie(settings.bilibiliCookie);
  }

  return true;
});

// IPC: Process video
ipcMain.handle('video:process', async (event, url, options) => {
  const { numPoints = 8, model = 'minimax', outputDir = './output' } = options;
  const cookiePath = getCookiePath();
  const settings = store.get('settings', {});

  try {
    // Step 1: Get metadata, subtitle, transcription
    event.sender.send('video:progress', { step: 1, message: '获取视频信息...' });
    const { metadata, subtitlePath, transcription } = await videoFetcher(url, {
      cookiePath,
      whisperPath: settings.whisperPath,
      onProgress: (p) => event.sender.send('video:progress', p)
    });

    // Step 2: Analyze keypoints (segment-based)
    event.sender.send('video:progress', { step: 2, message: '分析关键内容点...' });
    const { keypoints } = await aiService.analyze(subtitlePath, numPoints, model, transcription);

    // Step 3: Extract screenshots
    event.sender.send('video:progress', { step: 3, message: '截取关键帧...' });
    const screenshots = await screenshotExtractor(metadata.videoPath, keypoints, outputDir);

    // Step 4: Generate Markdown
    event.sender.send('video:progress', { step: 4, message: '生成笔记...' });
    const outputPath = await markdownGenerator(metadata, keypoints, screenshots, outputDir);

    return { success: true, outputPath, metadata, keypoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

- [ ] **Step 2: Update aiService.analyze signature**

Update `electron/backend/ai/index.js`:

```javascript
async analyze(subtitle, numPoints, model = 'minimax', transcription = null) {
  const provider = this.providers[model];
  if (!provider) throw new Error(`Unknown model: ${model}`);

  // Pass transcription if available
  if (provider.analyzeWithTranscription) {
    return provider.analyzeWithTranscription(subtitle, transcription, numPoints);
  }

  return provider.generate(subtitle, numPoints);
}
```

- [ ] **Step 3: Update MinimaxProvider to support transcription**

Add to `electron/backend/ai/minimax.js`:

```javascript
async analyzeWithTranscription(subtitlePath, transcription, numPoints) {
  // Use transcription if no subtitle
  if (!subtitlePath && transcription) {
    // MiniMax will analyze the transcription segments
    return this.analyzeSegment(transcription, numPoints);
  }

  // Fall back to regular generate
  return this.generate(subtitlePath, numPoints);
}

async analyzeSegment(transcription, numPoints) {
  // Transcribe is already done, just analyze
  const text = transcription.map(s => s.text).join('\n');
  return this.generate(text, numPoints);
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/backend/server.js electron/backend/ai/index.js electron/backend/ai/minimax.js
git commit -m "feat: integrate all components in server"
```

---

## Task 9: Update Preload.js - Add New IPC APIs

**Files:**
- Modify: `electron/preload.js`

- [ ] **Step 1: Add new APIs**

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // Video processing
  processVideo: (url, options) => ipcRenderer.invoke('video:process', url, options),
  cancelProcess: () => ipcRenderer.invoke('video:cancel'),

  // Progress
  onProgress: (callback) => ipcRenderer.on('video:progress', (_, data) => callback(data)),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Dialogs
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters),

  // Shell
  openFolder: (path) => ipcRenderer.invoke('shell:openPath', path),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: add new IPC APIs to preload"
```

---

## Task 10: Final Testing

- [ ] **Step 1: Build and test**

```bash
npm run build
npm run electron
```

- [ ] **Step 2: Test complete flow**

1. Open Settings, enter Bilibili Cookie and MiniMax API Key
2. Enter a Bilibili video URL (with subtitle)
3. Verify progress bar shows steps
4. Verify output files are organized in folders

- [ ] **Step 3: Test no-subtitle flow**

1. Find a video without subtitles
2. Verify Whisper transcription is triggered
3. Verify keypoints are extracted from transcription

- [ ] **Step 4: Commit any fixes**

```bash
git add .
git commit -m "fix: final UI improvements and bug fixes"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | SettingsModal - Cookie, Output Dir, Whisper path inputs |
| 2 | Cookie manager utility |
| 3 | Transcription manager (Whisper.cpp) |
| 4 | video-fetcher with no-subtitle handling |
| 5 | keypoint-analyzer with segment-based analysis |
| 6 | Toolbar with progress display and validation |
| 7 | Organized output structure |
| 8 | Server integration |
| 9 | Preload APIs |
| 10 | Final testing |

---

## API/Model Summary

| Component | API/Model | Cost |
|-----------|-----------|------|
| Video metadata | yt-dlp (local) | Free |
| Subtitle download | yt-dlp + B站 cookies | Free |
| Audio transcription | Whisper.cpp (local) | Free |
| Keypoint analysis | MiniMax M2.7 | User's API key |
| Screenshot extraction | ffmpeg (local) | Free |
| Markdown generation | Local | Free |

---

## Output Structure

```
output/
└── 视频标题/
    ├── notes.md           # 笔记正文
    ├── metadata.json      # 视频元数据
    ├── keypoints.json     # 所有知识点
    ├── transcription.json  # 转写文本（如果有）
    ├── subtitles/        # 字幕文件夹
    │   └── zh-CN.srt
    └── screenshots/     # 截图文件夹
        ├── screenshot-1.png
        └── ...
```
