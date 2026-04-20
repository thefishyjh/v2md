import { useState } from 'react';
import SettingsModal from './SettingsModal';

const MODELS = [
  { id: 'anthropic', name: 'Claude' },
  { id: 'minimax', name: 'Minimax' },
  { id: 'deepseek', name: 'DeepSeek' },
];

export default function Toolbar({ onProgress }) {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('anthropic');
  const [numPoints, setNumPoints] = useState(8);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  return (
    <>
      <div className="bg-white border-t p-4 flex items-center gap-4 relative">
        <input
          type="text"
          placeholder="输入 B站视频链接..."
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
            onChange={(e) => setNumPoints(parseInt(e.target.value))}
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}