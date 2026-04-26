const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu, nativeImage, systemPreferences, session } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

let win;
let dashboardWin;
let tray;
let isRecording = false;
let isQuitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 300,
    height: 200,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  // Hide instead of close, unless the app is quitting
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function openDashboard() {
  if (dashboardWin) {
    dashboardWin.show();
    dashboardWin.focus();
    app.dock.show();
    return;
  }

  app.dock.show();

  dashboardWin = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Ada',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dashboardWin.loadFile('dashboard.html');

  dashboardWin.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      dashboardWin.hide();
      app.dock.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayIconTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Ada - Speech to Text');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ada - Speech to Text', enabled: false },
    { type: 'separator' },
    { label: 'Dashboard', click: () => openDashboard() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

function pasteText(text) {
  return new Promise((resolve) => {
    // Write to system clipboard via pbcopy
    const { spawn } = require('child_process');
    const pbcopy = spawn('pbcopy', [], { env: { ...process.env, LANG: 'en_US.UTF-8' } });
    pbcopy.stdin.write(text, 'utf-8');
    pbcopy.stdin.end();

    pbcopy.on('close', () => {
      console.log('[Ada] Clipboard set via pbcopy');

      // Simulate Cmd+V via CGEvent through osascript ObjC bridge
      // This runs under the terminal's existing accessibility permission
      const script = `
        ObjC.import('CoreGraphics');
        delay(0.1);
        var keyDown = $.CGEventCreateKeyboardEvent(null, 9, true);
        var keyUp = $.CGEventCreateKeyboardEvent(null, 9, false);
        $.CGEventSetFlags(keyDown, $.kCGEventFlagMaskCommand);
        $.CGEventSetFlags(keyUp, $.kCGEventFlagMaskCommand);
        $.CGEventPost($.kCGHIDEventTap, keyDown);
        $.CGEventPost($.kCGHIDEventTap, keyUp);
      `;

      exec(`osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
        if (err) console.error('[Ada] CGEvent paste error:', err);
        else console.log('[Ada] Text pasted via CGEvent');
        resolve();
      });
    });
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  if (process.platform === 'darwin') {
    // Request microphone permission (triggers system prompt)
    await systemPreferences.askForMediaAccess('microphone');
    // Request accessibility/input monitoring (triggers system prompt)
    systemPreferences.isTrustedAccessibilityClient(true);
  }

  // Launch on startup
  app.setLoginItemSettings({ openAtLogin: true });

  // Allow the renderer to use microphone via getUserMedia
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createWindow();
  createTray();

  // Register global shortcut: Ctrl+Shift+Space
  globalShortcut.register('Control+Shift+Space', () => {
    isRecording = !isRecording;
    if (isRecording) {
      tray.setToolTip('Ada - Recording...');
      win.webContents.send('toggle-recording', true);
    } else {
      tray.setToolTip('Ada - Processing...');
      win.webContents.send('toggle-recording', false);
    }
  });
});

// Receive audio data from renderer, send to Whisper
ipcMain.handle('transcribe', async (_event, audioArray) => {
  try {
    console.log('[Ada] Received audio data, size:', audioArray.length, 'bytes');

    const buffer = Buffer.from(audioArray);
    console.log('[Ada] Buffer created, size:', buffer.length);

    // Build multipart form body manually (no npm dependencies)
    const boundary = '----AdaBoundary' + Date.now();
    const parts = [];

    // File part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n` +
      `Content-Type: audio/webm\r\n\r\n`
    );
    parts.push(buffer);
    parts.push('\r\n');

    // Model part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `${config.model}\r\n`
    );

    parts.push(`--${boundary}--\r\n`);

    // Combine into a single Buffer
    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p))
    );

    console.log('[Ada] Sending to Whisper API...');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openai_api_key}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const data = await res.json();
    console.log('[Ada] Whisper response:', JSON.stringify(data));

    if (data.text) {
      tray.setToolTip('Ada - Speech to Text');
      await pasteText(data.text);
      return { success: true, text: data.text };
    } else {
      tray.setToolTip('Ada - Error');
      console.error('[Ada] Whisper error:', data);
      return { success: false, error: data };
    }
  } catch (err) {
    tray.setToolTip('Ada - Error');
    console.error('[Ada] Transcribe error:', err);
    return { success: false, error: err.message };
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
