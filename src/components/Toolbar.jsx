import { useEffect, useState } from 'react';
import SettingsModal from './SettingsModal';

const MODELS = [
  { id: 'anthropic', name: 'Claude' },
  { id: 'minimax', name: 'Minimax' },
  { id: 'deepseek', name: 'DeepSeek' },
];

export default function Toolbar({ onProgress, onCompleted }) {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('anthropic');
  const [numPoints, setNumPoints] = useState(8);
  const [outputDir, setOutputDir] = useState('./output');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    window.electronAPI.getSettings().then((settings = {}) => {
      if (settings.outputDir) setOutputDir(settings.outputDir);
      if (settings.defaultModel) setModel(settings.defaultModel);
    });

    const unsubscribe = window.electronAPI.onProgress((data) => {
      setProgress(data);
      onProgress?.(data);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [onProgress]);

  async function handleStart() {
    const rawInput = url.trim();
    if (!rawInput) {
      setError('请输入视频链接');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const finalUrl = normalizeBilibiliInput(rawInput);
    const normalizedUrl = finalUrl.toLowerCase();
    const isBilibiliUrl = normalizedUrl.includes('bilibili.com') || normalizedUrl.includes('b23.tv');
    if (!isBilibiliUrl) {
      setError('请输入有效的 B 站链接，或直接输入 BV/av 号');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    setProgress({ step: 0, message: '开始处理...' });

    try {
      const result = await window.electronAPI.processVideo(finalUrl, { model, numPoints, outputDir });
      if (result.success) {
        setProgress({ step: 4, message: '完成' });
        setSuccess(`笔记已生成：${result.outputPath}`);
        onCompleted?.(result);
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

  async function handleCancel() {
    try {
      await window.electronAPI.cancelProcess();
      setProgress({ step: progress?.step || 0, message: '正在取消...' });
    } catch (err) {
      setError(err.message || '取消失败');
    }
  }

  return (
    <>
      <div className="bg-white border-t p-4 flex items-center gap-4 relative">
        <input
          type="text"
          placeholder="输入 B 站视频链接..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
          disabled={loading}
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="px-3 py-2 border rounded"
          disabled={loading}
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">关键点: {numPoints}</span>
          <input
            type="range"
            min="3"
            max="15"
            value={numPoints}
            onChange={(e) => setNumPoints(parseInt(e.target.value, 10))}
            className="w-24"
          />
        </div>
        <button
          onClick={handleStart}
          disabled={loading || !url}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          {loading ? '处理中...' : '开始'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          设置
        </button>
      </div>

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
                onClick={handleCancel}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-full left-0 right-0 bg-red-50 border-b border-red-200 p-3 text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="absolute bottom-full left-0 right-0 bg-green-50 border-b border-green-200 p-3 text-green-600">
          {success}
        </div>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            window.electronAPI.getSettings().then((settings = {}) => {
              if (settings.outputDir) setOutputDir(settings.outputDir);
            });
          }}
        />
      )}
    </>
  );
}

function normalizeBilibiliInput(input) {
  const text = String(input || '').trim();
  if (!text) return '';

  const bvMatch = text.match(/^(BV[0-9A-Za-z]+)$/i);
  if (bvMatch) {
    return `https://www.bilibili.com/video/${bvMatch[1]}`;
  }

  const avMatch = text.match(/^(av\d+)$/i);
  if (avMatch) {
    return `https://www.bilibili.com/video/${avMatch[1]}`;
  }

  try {
    const u = new URL(text);
    if (u.hostname.includes('bilibili.com') || u.hostname.includes('b23.tv')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch {
    // Keep raw input if not a valid URL
  }

  return text;
}
