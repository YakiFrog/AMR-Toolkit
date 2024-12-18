import React from 'react';
import { FaMapMarkerAlt, FaTrash } from 'react-icons/fa';

interface WaypointToolProps {
  waypoints: { x: number; y: number }[];
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
}

export const WaypointTool: React.FC<WaypointToolProps> = ({ waypoints, setWaypoints }) => {
  if (waypoints.length === 0) return null;

  return (
    <div className="mt-4 p-2 bg-gray-700 rounded">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-bold flex items-center gap-2">
          <FaMapMarkerAlt className="text-red-500" />
          Waypoints ({waypoints.length})
        </h3>
        <button
          onClick={() => setWaypoints([])}
          className="bg-red-500 hover:bg-red-600 p-2 rounded text-white"
          title="全て削除"
        >
          <FaTrash className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-2">
        {waypoints.map((waypoint, index) => (
          <div key={index} className="flex items-center justify-between text-white bg-gray-600 p-2 rounded">
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className="text-red-500" />
              <span>#{index + 1}:</span>
              <span>x: {Math.round(waypoint.x)}</span>
              <span>y: {Math.round(waypoint.y)}</span>
            </div>
            <button
              onClick={() => setWaypoints(prev => prev.filter((_, i) => i !== index))}
              className="text-red-500 hover:text-red-400"
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
