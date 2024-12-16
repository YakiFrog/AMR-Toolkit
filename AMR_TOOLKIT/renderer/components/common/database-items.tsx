
import React, { useEffect, useState } from 'react';
import { getDB } from '../../db';

interface DBItem {
  fileName?: string;
  lastModified?: number;
}

export const DatabaseItems: React.FC = () => {
  const [items, setItems] = useState<DBItem[]>([]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const db = await getDB();
        const pgmState = await db.get('pgmState', 'currentPGM');
        
        if (pgmState) {
          setItems([{
            fileName: pgmState.fileName,
            lastModified: pgmState.lastModified
          }]);
        }
      } catch (error) {
        console.error('Failed to load database items:', error);
      }
    };

    loadItems();
  }, []);

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500">保存されているPGMファイルはありません。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        保存済みPGMファイル
      </h3>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="border-b border-gray-200 pb-2">
            <p className="font-medium text-gray-700">{item.fileName}</p>
            <p className="text-sm text-gray-500">
              最終更新: {new Date(item.lastModified).toLocaleString('ja-JP')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};