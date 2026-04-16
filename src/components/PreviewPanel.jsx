export default function PreviewPanel({ note }) {
  if (!note) {
    return (
      <div className="w-80 bg-gray-50 flex items-center justify-center text-gray-400">
        选择笔记查看预览
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l flex flex-col">
      {/* 视频信息 */}
      <div className="p-4 border-b">
        <h3 className="font-bold truncate">{note.title}</h3>
        <div className="text-sm text-gray-500 mt-1">
          <div>UP主: {note.uploader}</div>
          <div>时长: {note.duration}</div>
        </div>
      </div>

      {/* 关键点列表 */}
      <div className="p-4 border-b">
        <h4 className="font-medium mb-2">关键内容点</h4>
        <div className="space-y-2">
          {note.keypoints?.map((kp, i) => (
            <div key={i} className="text-sm">
              <span className="font-mono text-blue-500">[{kp.time}]</span>
              <span className="ml-1">{kp.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 截图网格 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h4 className="font-medium mb-2">截图</h4>
        <div className="grid grid-cols-2 gap-2">
          {note.screenshots?.map((s, i) => (
            <img
              key={i}
              src={`file://${s}`}
              alt={`截图 ${i + 1}`}
              className="w-full rounded border cursor-pointer hover:ring-2 hover:ring-blue-400"
              onClick={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
