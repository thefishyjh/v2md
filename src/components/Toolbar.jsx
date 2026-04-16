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

  async function handleStart() {
    if (!url) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.processVideo(url, { model, numPoints });
      if (result.success) {
        onProgress?.({ step: 4, message: '完成', result });
      } else {
        onProgress?.({ error: result.error });
      }
    } catch (err) {
      onProgress?.({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-white border-t p-4 flex items-center gap-4">
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}