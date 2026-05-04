import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  anthropicApiKey: '',
  minimaxApiKey: '',
  minimaxBaseUrl: 'https://api.minimax.io',
  minimaxModel: 'MiniMax-M2.7',
  deepseekApiKey: '',
  bilibiliCookie: '',
  outputDir: './output',
  whisperPath: '',
};

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [validatingMinimax, setValidatingMinimax] = useState(false);
  const [minimaxValidationMessage, setMinimaxValidationMessage] = useState('');
  const [minimaxValidationType, setMinimaxValidationType] = useState('');

  useEffect(() => {
    window.electronAPI.getSettings().then((saved = {}) => {
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
    });
  }, []);

  async function handleSave() {
    await window.electronAPI.saveSettings(settings);
    onClose();
  }

  async function handleValidateMinimaxKey() {
    const apiKey = String(settings.minimaxApiKey || '').trim();
    if (!apiKey) {
      setMinimaxValidationType('error');
      setMinimaxValidationMessage('请先填写 Minimax API Key');
      return;
    }

    setValidatingMinimax(true);
    setMinimaxValidationType('');
    setMinimaxValidationMessage('正在验证 Minimax API Key...');

    try {
      const result = await window.electronAPI.validateMinimaxKey({
        apiKey,
        baseUrl: settings.minimaxBaseUrl,
        model: settings.minimaxModel,
      });

      if (result?.success) {
        setMinimaxValidationType('success');
        setMinimaxValidationMessage(result.message || 'Minimax API Key 验证通过');
      } else {
        setMinimaxValidationType('error');
        setMinimaxValidationMessage(result?.error || 'Minimax API Key 验证失败');
      }
    } catch (error) {
      setMinimaxValidationType('error');
      setMinimaxValidationMessage(String(error?.message || 'Minimax API Key 验证失败'));
    } finally {
      setValidatingMinimax(false);
    }
  }

  function updateSettingField(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (field === 'minimaxApiKey' || field === 'minimaxBaseUrl' || field === 'minimaxModel') {
      setMinimaxValidationType('');
      setMinimaxValidationMessage('');
    }
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
              onChange={(e) => updateSettingField('anthropicApiKey', e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="sk-ant-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Minimax API Key</label>
            <input
              type="password"
              value={settings.minimaxApiKey}
              onChange={(e) => updateSettingField('minimaxApiKey', e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleValidateMinimaxKey}
                disabled={validatingMinimax}
                className="px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-60"
              >
                {validatingMinimax ? '验证中...' : '验证 API Key'}
              </button>
              {minimaxValidationMessage ? (
                <span className={`text-xs ${minimaxValidationType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {minimaxValidationMessage}
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Minimax Base URL</label>
            <input
              type="text"
              value={settings.minimaxBaseUrl}
              onChange={(e) => updateSettingField('minimaxBaseUrl', e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="https://api.minimax.io"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Minimax Model</label>
            <input
              type="text"
              value={settings.minimaxModel}
              onChange={(e) => updateSettingField('minimaxModel', e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="MiniMax-M2.7"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">DeepSeek API Key</label>
            <input
              type="password"
              value={settings.deepseekApiKey}
              onChange={(e) => updateSettingField('deepseekApiKey', e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">B站完整 Cookie（用于通过 412 鉴权）</label>
            <textarea
              value={settings.bilibiliCookie}
              onChange={(e) => updateSettingField('bilibiliCookie', e.target.value)}
              className="w-full px-3 py-2 border rounded font-mono text-xs"
              rows={3}
              placeholder="粘贴浏览器请求头中的整段 Cookie（包含 SESSDATA、bili_jct、buvid3 等）"
            />
            <p className="text-xs text-gray-500 mt-1">
              获取方法：登录 B站后，F12 → Network → 任意 video 接口 → Request Headers → 复制整段 Cookie
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">输出目录</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.outputDir}
                onChange={(e) => updateSettingField('outputDir', e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                placeholder="./output"
              />
              <button
                onClick={() => {
                  window.electronAPI.selectDirectory().then((dir) => {
                    if (dir) {
                      setSettings((prev) => ({ ...prev, outputDir: dir }));
                    }
                  });
                }}
                className="px-3 py-2 border rounded hover:bg-gray-50"
              >
                选择
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">whisper.cpp 可执行文件路径（可选）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.whisperPath}
                onChange={(e) => updateSettingField('whisperPath', e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                placeholder="留空自动查找 whisper.cpp/build/bin/whisper-cli.exe"
              />
              <button
                onClick={() => {
                  window.electronAPI.selectFile(['exe']).then((file) => {
                    if (file) {
                      setSettings((prev) => ({ ...prev, whisperPath: file }));
                    }
                  });
                }}
                className="px-3 py-2 border rounded hover:bg-gray-50"
              >
                选择
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">请把模型放到 whisper.cpp/models/ggml-small.bin</p>
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

