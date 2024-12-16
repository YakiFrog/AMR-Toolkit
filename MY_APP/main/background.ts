import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    // mainWindow.webContents.openDevTools()
  }
})()

// アプリケーション終了時の処理を修正
app.on('before-quit', async (event) => {
  event.preventDefault(); // 即座の終了を防ぐ
  const mainWindow = global.windows?.get('main');
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('clear-db');
      // 確実にDBクリアを待つ
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
    app.exit();
  }
});

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
