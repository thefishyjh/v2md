import { useState, useEffect } from 'react';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    anthropicApiKey: '',
    minimaxApiKey: '',
    minimaxBaseUrl: 'https://api.minimax.chat',
    deepseekApiKey: '',
    outputDir: './output',
    ffmpegPath: '',
  });

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
  }, []);

  async function handleSave() {
    await window.electronAPI.saveSettings(settings);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">设置</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Claude API Key</label>
            <input
              type="password"
              value={settings.anthropicApiKey}
              onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="sk-ant-..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Minimax API Key</label>
            <input
              type="password"
              value={settings.minimaxApiKey}
              onChange={(e) => setSettings({ ...settings, minimaxApiKey: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">DeepSeek API Key</label>
            <input
              type="password"
              value={settings.deepseekApiKey}
              onChange={(e) => setSettings({ ...settings, deepseekApiKey: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">输出目录</label>
            <input
              type="text"
              value={settings.outputDir}
              onChange={(e) => setSettings({ ...settings, outputDir: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">保存</button>
        </div>
      </div>
    </div>
  );
}