import { useState, useEffect } from 'react';
import { historyStore } from '../store/historyStore';

export default function HistoryPanel({ onSelect, currentNote }) {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const data = await historyStore.getAll();
    setNotes(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  const filtered = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase())
  );

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
        {filtered.map(note => (
          <div
            key={note.id}
            onClick={() => onSelect(note)}
            className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
              currentNote?.id === note.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="font-medium truncate">{note.title}</div>
            <div className="text-sm text-gray-500">{note.createdAt}</div>
            <div className="text-xs text-gray-400">{note.screenshotCount} 张截图</div>
          </div>
        ))}
      </div>
    </div>
  );
}
