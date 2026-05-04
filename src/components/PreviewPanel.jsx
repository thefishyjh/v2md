export default function PreviewPanel({ note }) {
  if (!note) {
    return (
      <div className="w-80 bg-gray-50 flex items-center justify-center text-gray-400 border-l">
        选择笔记查看摘要
      </div>
    );
  }

  const screenshots = note.screenshotUrls || note.screenshots || [];

  return (
    <div className="w-80 bg-white border-l flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-bold line-clamp-2">{note.title}</h3>
        <div className="text-sm text-gray-500 mt-2 space-y-1">
          <div>UP主: {note.uploader || '未知'}</div>
          <div>时长: {note.duration || '未知'}</div>
        </div>
      </div>

      <div className="p-4 border-b max-h-80 overflow-y-auto">
        <h4 className="font-medium mb-2">关键内容点</h4>
        {note.keypoints?.length ? (
          <div className="space-y-2">
            {note.keypoints.map((kp, i) => (
              <button
                key={`${kp.time}-${i}`}
                type="button"
                className="block w-full text-left text-sm rounded p-1 hover:bg-gray-50"
                onClick={() => {}}
              >
                <span className="font-mono text-blue-500">[{kp.time}]</span>
                <span className="ml-1">{kp.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">暂无关键内容点</div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <h4 className="font-medium mb-2">截图</h4>
        {screenshots.length ? (
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt={`截图 ${i + 1}`}
                className="w-full aspect-video object-cover rounded border cursor-pointer hover:ring-2 hover:ring-blue-400"
                onClick={() => {}}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">暂无截图</div>
        )}
      </div>
    </div>
  );
}
