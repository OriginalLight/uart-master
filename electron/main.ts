import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  // Completely remove the default menu bar (File, Edit, etc.) for all platforms
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: true,
    },
    title: "Uart Master",
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // Explicitly remove menu from this window
  win.setMenu(null);
  
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Correctly resolve path for production build
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // CRITICAL: Web Serial handling in Electron
  // 1. Permission check for the 'serial' API
  win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'serial') {
      return true;
    }
    return false;
  });

  // 2. Permission check for individual devices
  win.webContents.session.setDevicePermissionHandler((_details) => {
    if (_details.deviceType === 'serial') {
      return true;
    }
    return false;
  });

  // 3. Port selector event handler
  // Electron does not show a native UI for this.
  // We automatically pick the first available port for simplicity.
  (win.webContents.session as any).on('select-serial-port', (event: any, portList: any, webContents: any, callback: any) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      callback(portList[0].portId);
    } else {
      callback(''); // No device selected
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
