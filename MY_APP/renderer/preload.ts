import { contextBridge, ipcRenderer } from 'electron';
import { clearDB } from './db';

contextBridge.exposeInMainWorld('electron', {
  onClearDB: (callback: () => void) => {
    ipcRenderer.on('clear-db', () => {
      callback();
      // 登録解除して重複を防ぐ
      ipcRenderer.removeAllListeners('clear-db');
    });
  }
});