import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';

export default function EditorPanel({ note, onTimestampClick }) {
  const [content, setContent] = useState('');
  const [view, setView] = useState('preview'); // 'edit' | 'preview' | 'split'
  const [assetBaseUrl, setAssetBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;

    async function loadNote() {
      setContent('');
      setAssetBaseUrl('');
      setError('');

      if (!note?.filePath) {
        return;
      }

      if (!window.electronAPI?.readNote) {
        setError('当前环境无法读取本地笔记文件');
        return;
      }

      setLoading(true);
      try {
        const result = await window.electronAPI.readNote(note.filePath);
        if (canceled) return;
        setContent(result.content || '');
        setAssetBaseUrl(result.assetBaseUrl || '');
      } catch (err) {
        if (canceled) return;
        setError(err.message || '读取笔记失败');
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    loadNote();

    return () => {
      canceled = true;
    };
  }, [note]);

  const html = useMemo(() => {
    const renderer = new marked.Renderer();

    renderer.image = (href, title, text) => {
      const src = resolveAssetUrl(href, assetBaseUrl);
      const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || '')}"${safeTitle}>`;
    };

    return marked.parse(content || '', {
      breaks: true,
      gfm: true,
      renderer,
    });
  }, [assetBaseUrl, content]);

  function handleTimestampClick(e) {
    const targetText = e.target.textContent || '';
    const match = targetText.match(/\[(\d+):(\d+)\]/);
    if (match) {
      onTimestampClick(`${match[1]}:${match[2].padStart(2, '0')}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      <div className="flex border-b p-2 gap-2">
        <ViewButton active={view === 'edit'} onClick={() => setView('edit')}>编辑</ViewButton>
        <ViewButton active={view === 'preview'} onClick={() => setView('preview')}>预览</ViewButton>
        <ViewButton active={view === 'split'} onClick={() => setView('split')}>分栏</ViewButton>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!note && <EmptyState title="选择一条历史记录" description="完整笔记会显示在这里。" />}
        {note && loading && <EmptyState title="正在读取笔记..." description="稍等一下，正在打开本地 notes.md。" />}
        {note && !loading && error && <EmptyState title="读取笔记失败" description={error} />}
        {note && !loading && !error && !content.trim() && (
          <EmptyState title="笔记内容为空" description="这个 notes.md 暂时没有可展示的 Markdown 内容。" />
        )}
        {note && !loading && !error && content.trim() && (
          <>
            {view !== 'preview' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 p-5 font-mono text-sm resize-none border-r outline-none min-w-0"
                placeholder="选择左侧历史记录或开始新转换..."
              />
            )}
            {view !== 'edit' && (
              <div className="flex-1 overflow-y-auto min-w-0" onClick={handleTimestampClick}>
                <article
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center text-gray-400">
      <div>
        <div className="text-base font-medium text-gray-500">{title}</div>
        <div className="mt-2 text-sm">{description}</div>
      </div>
    </div>
  );
}

function resolveAssetUrl(href, assetBaseUrl) {
  const value = String(href || '').replace(/\\/g, '/');
  if (!value) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;
  if (!assetBaseUrl) return value;

  try {
    return new URL(value, assetBaseUrl).href;
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
