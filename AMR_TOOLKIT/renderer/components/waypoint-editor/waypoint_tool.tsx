import React from 'react';
import { FaMapMarkerAlt, FaTrash, FaRoute } from 'react-icons/fa'; // FaRouteを追加

interface WaypointToolProps {
  waypoints: { x: number; y: number; theta: number }[];
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number; y: number; theta: number }[]>>;
  onPlanPath?: () => void; // 追加
  isPlanning?: boolean; // 追加
}

export const WaypointTool: React.FC<WaypointToolProps> = ({ waypoints, setWaypoints, onPlanPath, isPlanning }) => {
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
        <div className="space-x-2">
          <button
            onClick={() => setWaypoints([])}
            className="text-slate-400 hover:text-slate-200 p-2 rounded hover:bg-slate-700 transition-colors"
            title="全て削除"
          >
            <FaTrash className="w-4 h-4" />
          </button>
          <button
            onClick={onPlanPath}
            disabled={isPlanning || waypoints.length < 2}
            className={`p-2 rounded transition-colors ${
              waypoints.length < 2
                ? 'text-gray-600 cursor-not-allowed'
                : isPlanning
                ? 'bg-blue-600/50 text-white'
                : 'text-blue-500 hover:bg-blue-500 hover:text-white'
            }`}
            title="パスを計画"
          >
            <FaRoute className="w-4 h-4" />
          </button>
        </div>
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
