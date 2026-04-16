import { useState } from 'react';
import HistoryPanel from './components/HistoryPanel';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import Toolbar from './components/Toolbar';

export default function App() {
  const [currentNote, setCurrentNote] = useState(null);
  const [progress, setProgress] = useState(null);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 主工作区 */}
      <div className="flex-1 flex overflow-hidden">
        <HistoryPanel onSelect={setCurrentNote} currentNote={currentNote} />
        <EditorPanel note={currentNote} onTimestampClick={(time) => {}} />
        <PreviewPanel note={currentNote} />
      </div>
      {/* 底部工具栏 */}
      <Toolbar onProgress={setProgress} progress={progress} />
    </div>
  );
}
