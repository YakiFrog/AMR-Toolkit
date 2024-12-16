import { openDB, DBSchema } from 'idb';

interface PGMAppDB extends DBSchema {
  sidebarItems: {
    key: string;
    value: {
      id: string;
      order: number;
      href: string;
      label: string;
    };
  };
  pgmState: {
    key: string;
    value: {
      file: ArrayBuffer;
      fileName: string;
      lastModified: number;
      viewerState?: {
        scale: number;
        scrollLeft: number;
        scrollTop: number;
      };
    };
  };
}

const DB_NAME = 'pgm-editor-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return await openDB<PGMAppDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sidebarItems')) {
        db.createObjectStore('sidebarItems', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pgmState')) {
        db.createObjectStore('pgmState');
      }
    },
  });
};

export const getDB = async () => {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      return await initDB();
    } catch (error) {
      console.error(`DB initialization failed (attempt ${retryCount + 1}):`, error);
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error('データベースの初期化に失敗しました。');
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
    }
  }
  throw new Error('予期せぬエラーが発生しました。');
};

export const clearDB = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction('pgmState', 'readwrite');
    await tx.objectStore('pgmState').delete('currentPGM');
    await tx.done;
  } catch (error) {
    console.error('Failed to clear DB:', error);
    // エラーを上位に伝播させない
  }
};