import React from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// 明示的なexport宣言を追加
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
}

export interface LayerPanelProps {
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ layers, onToggleLayer }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">レイヤー</h3>
      <div className="space-y-2">
        {layers.map(layer => (
          <div
            key={layer.id}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: layer.color }}
              />
              <span className="text-sm text-gray-700">{layer.name}</span>
            </div>
            <button
              onClick={() => onToggleLayer(layer.id)}
              className="text-gray-600 hover:text-gray-900"
              title={layer.visible ? "非表示" : "表示"}
            >
              {layer.visible ? (
                <FaEye className="w-5 h-5" />
              ) : (
                <FaEyeSlash className="w-5 h-5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};