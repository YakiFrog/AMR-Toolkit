import React, { useEffect, useState } from 'react';
import { getDB } from '../../db';
import { FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

interface DBItem {
  fileName?: string;
  lastModified?: number;
  type: 'pgm' | 'drawing';
}

export const DatabaseItems: React.FC = () => {
  const [items, setItems] = useState<DBItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        setIsLoading(true);
        const db = await getDB();
        
        // PGMデータの取得
        const pgmState = await db.get('pgmState', 'currentPGM');
        const pgmItem = pgmState ? {
          fileName: pgmState.fileName,
          lastModified: pgmState.lastModified,
          type: 'pgm' as const
        } : null;

        // 描写データの取得
        const drawingState = pgmState?.drawingData ? {
          fileName: `${pgmState.fileName}_drawing`,
          lastModified: pgmState.drawingData.lastModified,
          type: 'drawing' as const
        } : null;

        const allItems: DBItem[] = [
          ...(pgmItem ? [pgmItem] : []),
          ...(drawingState ? [drawingState] : [])
        ];
        
        setItems(allItems);
      } catch (error) {
        console.error('Failed to load database items:', error);
        toast.error('データの読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, []);

  const handleClear = async (type: 'pgm' | 'drawing') => {
    try {
      const db = await getDB();
      const currentState = await db.get('pgmState', 'currentPGM');

      if (type === 'pgm') {
        await db.delete('pgmState', 'currentPGM');
        setItems(items.filter(item => item.type !== 'pgm'));
        toast.success('PGMデータを削除しました');
      } else if (currentState) {
        // 描写データのみを削除
        await db.put('pgmState', {
          ...currentState,
          drawingData: null
        }, 'currentPGM');
        setItems(items.filter(item => item.type !== 'drawing'));
        toast.success('描写データを削除しました');
      }
    } catch (error) {
      console.error('Failed to clear database:', error);
      toast.error('データの削除に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-500">保存されているファイルはありません。</p>
      </div>
    );
  }

  const pgmItems = items.filter(item => item.type === 'pgm');
  const drawingItems = items.filter(item => item.type === 'drawing');

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-6">
      {/* PGMファイルセクション */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            保存済みPGMファイル
          </h3>
          {pgmItems.length > 0 && (
            <button
              onClick={() => handleClear('pgm')}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors"
            >
              <FaTrash className="w-4 h-4" />
              <span>PGMデータを削除</span>
            </button>
          )}
        </div>
        {pgmItems.length > 0 ? (
          <ul className="space-y-2">
            {pgmItems.map((item, index) => (
              <li key={index} className="border-b border-gray-200 pb-2">
                <p className="font-medium text-gray-700">{item.fileName}</p>
                <p className="text-sm text-gray-500">
                  最終更新: {new Date(item.lastModified).toLocaleString('ja-JP')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">保存されているPGMファイルはありません。</p>
        )}
      </div>

      {/* 描写データセクション */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            保存済み描写データ
          </h3>
          {drawingItems.length > 0 && (
            <button
              onClick={() => handleClear('drawing')}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors"
            >
              <FaTrash className="w-4 h-4" />
              <span>描写データを削除</span>
            </button>
          )}
        </div>
        {drawingItems.length > 0 ? (
          <ul className="space-y-2">
            {drawingItems.map((item, index) => (
              <li key={index} className="border-b border-gray-200 pb-2">
                <p className="font-medium text-gray-700">{item.fileName}</p>
                <p className="text-sm text-gray-500">
                  最終更新: {new Date(item.lastModified).toLocaleString('ja-JP')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">保存されている描写データはありません。</p>
        )}
      </div>
    </div>
  );
};