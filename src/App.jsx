import { useState } from 'react';
import HistoryPanel from './components/HistoryPanel';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import Toolbar from './components/Toolbar';

export default function App() {
  const [currentNote, setCurrentNote] = useState(null);
  const [progress, setProgress] = useState(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 主工作区 */}
      <div className="flex-1 flex overflow-hidden">
        <HistoryPanel
          onSelect={setCurrentNote}
          currentNote={currentNote}
          refreshToken={historyRefreshToken}
        />
        <EditorPanel note={currentNote} onTimestampClick={(time) => {}} />
        <PreviewPanel note={currentNote} />
      </div>
      {/* 底部工具栏 */}
      <Toolbar
        onProgress={setProgress}
        progress={progress}
        onCompleted={(result) => {
          if (result?.note) {
            setCurrentNote(result.note);
          }
          setHistoryRefreshToken((t) => t + 1);
        }}
      />
    </div>
  );
}
