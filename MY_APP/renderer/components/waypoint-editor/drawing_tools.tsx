import React from 'react';
import { FaPen, FaEraser } from 'react-icons/fa';

export type Tool = 'none' | 'pen' | 'eraser';

interface DrawingToolsProps {
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  penSize: number;
  setPenSize: (size: number) => void;
}

const DrawingTools: React.FC<DrawingToolsProps> = ({
  currentTool,
  setCurrentTool,
  penSize,
  setPenSize,
}) => {
  return (
    <div className="flex items-center justify-center gap-6"> {/* gap-4からgap-6に変更、justifyを追加 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentTool(currentTool === 'pen' ? 'none' : 'pen')}
          className={`p-3 rounded ${
            currentTool === 'pen' ? 'bg-blue-600' : 'bg-gray-600'
          } hover:opacity-80 transition-colors`}
          title="ペン"
        >
          <FaPen className="w-6 h-6 text-white" /> {/* サイズを少し大きく */}
        </button>
        <button
          onClick={() => setCurrentTool(currentTool === 'eraser' ? 'none' : 'eraser')}
          className={`p-3 rounded ${
            currentTool === 'eraser' ? 'bg-blue-600' : 'bg-gray-600'
          } hover:opacity-80 transition-colors`}
          title="消しゴム"
        >
          <FaEraser className="w-6 h-6 text-white" /> {/* サイズを少し大きく */}
        </button>
      </div>
      <div className="flex items-center gap-3 min-w-[200px]"> {/* 最小幅を設定 */}
        <input
          type="range"
          min="1"
          max="50"
          value={penSize}
          onChange={(e) => setPenSize(Number(e.target.value))}
          className="w-full"
        />
        <span className="text-sm text-white min-w-[3ch]">{penSize}</span>
      </div>
    </div>
  );
};

export { DrawingTools };