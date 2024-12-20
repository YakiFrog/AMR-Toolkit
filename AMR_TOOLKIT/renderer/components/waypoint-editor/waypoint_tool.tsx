import React from 'react';
import { FaMapMarkerAlt, FaTrash } from 'react-icons/fa';

interface WaypointToolProps {
  waypoints: { x: number; y: number; theta: number }[]; // theta を追加
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number; y: number; theta: number }[]>>;
}

export const WaypointTool: React.FC<WaypointToolProps> = ({ waypoints, setWaypoints }) => {
  if (waypoints.length === 0) return null;

  // 角度をラジアンから度数に変換する関数
  const toDegrees = (radians: number) => {
    return Math.round((radians * 180) / Math.PI);
  };

  return (
    <div className="bg-neutral-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-neutral-200 flex items-center gap-2">
          <FaMapMarkerAlt className="text-neutral-400" />
          Waypoints ({waypoints.length})
        </h3>
        <button
          onClick={() => setWaypoints([])}
          className="text-slate-400 hover:text-slate-200 p-2 rounded hover:bg-slate-700 transition-colors"
          title="全て削除"
        >
          <FaTrash className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-2">
        {waypoints.map((waypoint, index) => (
          <div key={index} className="flex items-center justify-between bg-neutral-800 p-2 rounded">
            <div className="flex items-center gap-4 text-neutral-200">
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt className="text-neutral-400" />
                <span>#{index + 1}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-neutral-400">
                <span>x: {Math.round(waypoint.x)}</span>
                <span>y: {Math.round(waypoint.y)}</span>
                <span>θ: {toDegrees(waypoint.theta)}°</span>
              </div>
            </div>
            <button
              onClick={() => setWaypoints(prev => prev.filter((_, i) => i !== index))}
              className="text-slate-400 hover:text-slate-200"
              title="削除"
            >
              <FaTrash className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
