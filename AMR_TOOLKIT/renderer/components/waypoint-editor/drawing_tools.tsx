import React from 'react';
import { FaPen, FaEraser, FaUndo, FaRedo } from 'react-icons/fa';

export type Tool = 'none' | 'pen' | 'eraser';

interface DrawingToolsProps {
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  penSize: number;
  setPenSize: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const DrawingTools: React.FC<DrawingToolsProps> = ({
  currentTool,
  setCurrentTool,
  penSize,
  setPenSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="flex items-center justify-between w-full px-4">
      <div className="flex items-center gap-6">
        {/* 既存のペンと消しゴムツール */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentTool(currentTool === 'pen' ? 'none' : 'pen')}
            className={`p-3 rounded ${
              currentTool === 'pen' ? 'bg-blue-600' : 'bg-gray-600'
            } hover:opacity-80 transition-colors`}
            title="ペン"
          >
            <FaPen className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => setCurrentTool(currentTool === 'eraser' ? 'none' : 'eraser')}
            className={`p-3 rounded ${
              currentTool === 'eraser' ? 'bg-blue-600' : 'bg-gray-600'
            } hover:opacity-80 transition-colors`}
            title="消しゴム"
          >
            <FaEraser className="w-6 h-6 text-white" />
          </button>
        </div>
        {/* 既存のペンサイズスライダー */}
        <div className="flex items-center gap-3 min-w-[200px]">
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
      
      {/* Undo/Redoボタン */}
      <div className="flex items-center gap-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-3 rounded ${
            canUndo ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-800 cursor-not-allowed'
          } transition-colors`}
          title="元に戻す"
        >
          <FaUndo className={`w-6 h-6 ${canUndo ? 'text-white' : 'text-gray-600'}`} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-3 rounded ${
            canRedo ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-800 cursor-not-allowed'
          } transition-colors`}
          title="やり直し"
        >
          <FaRedo className={`w-6 h-6 ${canRedo ? 'text-white' : 'text-gray-600'}`} />
        </button>
      </div>
    </div>
  );
};

export { DrawingTools };