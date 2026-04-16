import { useState, useEffect } from 'react';
import { marked } from 'marked';

export default function EditorPanel({ note, onTimestampClick }) {
  const [content, setContent] = useState('');
  const [view, setView] = useState('split'); // 'edit' | 'preview' | 'split'

  useEffect(() => {
    if (note?.filePath) {
      fetch(`file://${note.filePath}`)
        .then(r => r.text())
        .then(setContent);
    }
  }, [note]);

  function handleTimestampClick(e) {
    const match = e.target.href?.match(/\[(\d+):(\d+)\]/);
    if (match) {
      onTimestampClick(`${match[1]}:${match[2].padStart(2, '0')}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 工具栏 */}
      <div className="flex border-b p-2 gap-2">
        <button onClick={() => setView('edit')} className={`px-3 py-1 rounded ${view === 'edit' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>编辑</button>
        <button onClick={() => setView('preview')} className={`px-3 py-1 rounded ${view === 'preview' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>预览</button>
        <button onClick={() => setView('split')} className={`px-3 py-1 rounded ${view === 'split' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>分栏</button>
      </div>

      {/* 编辑器/预览 */}
      <div className="flex-1 flex overflow-hidden">
        {view !== 'preview' && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 p-4 font-mono text-sm resize-none border-r"
            placeholder="选择左侧历史记录或开始新转换..."
          />
        )}
        {view !== 'edit' && (
          <div
            className="flex-1 p-4 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: marked(content) }}
            onClick={handleTimestampClick}
          />
        )}
      </div>
    </div>
  );
}
