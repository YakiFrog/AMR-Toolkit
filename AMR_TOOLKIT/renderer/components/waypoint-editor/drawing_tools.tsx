import React from 'react';
import { FaPen, FaEraser, FaUndo, FaRedo, FaMapMarkerAlt } from 'react-icons/fa';

export type Tool = 'none' | 'pen' | 'eraser' | 'waypoint';

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

export const DrawingTools: React.FC<DrawingToolsProps> = ({
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
    <div className="flex items-center justify-between w-full px-4 py-2 bg-neutral-900 rounded-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTool(currentTool === 'pen' ? 'none' : 'pen')}
            className={`tool-button ${currentTool === 'pen' ? 'tool-active' : 'text-slate-200'}`}
            title="ペン"
          >
            <FaPen className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentTool(currentTool === 'eraser' ? 'none' : 'eraser')}
            className={`tool-button ${currentTool === 'eraser' ? 'tool-active' : 'text-slate-200'}`}
            title="消しゴム"
          >
            <FaEraser className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentTool(currentTool === 'waypoint' ? 'none' : 'waypoint')}
            className={`tool-button ${currentTool === 'waypoint' ? 'tool-active' : 'text-slate-200'}`}
            title="Waypoint"
          >
            <FaMapMarkerAlt className="w-5 h-5" />
          </button>
        </div>
        
        {currentTool !== 'waypoint' && (
          <div className="flex items-center gap-3 min-w-[200px]">
            <input
              type="range"
              min="1"
              max="50"
              value={penSize}
              onChange={(e) => setPenSize(Number(e.target.value))}
              className="custom-slider"
            />
            <span className="text-sm text-slate-200 min-w-[3ch]">{penSize}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`tool-button ${
            canUndo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'
          }`}
          title="元に戻す"
        >
          <FaUndo className="w-5 h-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`tool-button ${
            canRedo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-600 cursor-not-allowed'
          }`}
          title="やり直し"
        >
          <FaRedo className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};