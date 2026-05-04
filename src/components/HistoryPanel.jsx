import { useEffect, useState } from 'react';
import { historyStore } from '../store/historyStore';

export default function HistoryPanel({ onSelect, currentNote, refreshToken = 0 }) {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, [refreshToken]);

  async function loadHistory() {
    try {
      if (window.electronAPI?.getHistory) {
        const data = await window.electronAPI.getHistory();
        setNotes(sortNotes(data || []));
        return;
      }
    } catch (e) {
      // Fall back to IndexedDB below when Electron IPC is unavailable.
    }

    const data = await historyStore.getAll();
    setNotes(sortNotes(data || []));
  }

  const filtered = notes.filter((note) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [note.title, note.uploader]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  return (
    <div className="w-64 bg-white border-r flex flex-col">
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="搜索历史..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length ? (
          filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note)}
              className={`block w-full text-left p-3 border-b cursor-pointer hover:bg-gray-50 ${
                currentNote?.id === note.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium truncate">{getDisplayTitle(note)}</div>
              <div className="text-sm text-gray-500 mt-1">{formatCreatedAt(note.createdAt)}</div>
              <div className="text-xs text-gray-400 mt-1">{note.screenshotCount || 0} 张截图</div>
            </button>
          ))
        ) : (
          <div className="p-4 text-sm text-gray-400 text-center">没有匹配的历史记录</div>
        )}
      </div>
    </div>
  );
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getDisplayTitle(note) {
  const title = String(note.title || '').trim();
  if (title && !looksLikePath(title)) return title;

  const outputName = basename(note.outputPath);
  if (outputName && !looksLikePath(outputName)) return outputName;

  return '未命名笔记';
}

function looksLikePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.includes('\\') || value.includes('/notes.md');
}

function basename(value) {
  if (!value) return '';
  return String(value).split(/[\\/]/).filter(Boolean).pop() || '';
}

function formatCreatedAt(value) {
  if (!value) return '未知时间';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
