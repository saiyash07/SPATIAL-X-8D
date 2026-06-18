const { app, BrowserWindow, session, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// Force dark mode
nativeTheme.themeSource = 'dark';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'SPATIAL X 8D',

    // macOS native window
    titleBarStyle: 'hiddenInset',
    transparent: false,
    backgroundColor: '#060A12',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // ⚠️ Needed so Piped audio stream URLs (cross-origin) work with Web Audio API
      webSecurity: false,
      // Bypass standard autoplay restrictions for smooth playback
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // Strip Origin & Referer headers to bypass Cloudflare/Piped/YouTube blocks
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    const lowerUrl = details.url.toLowerCase();

    // Only strip for direct Piped API calls and GoogleVideo CDNs.
    // Do NOT strip for youtube.com itself to prevent breaking the iframe embed (Error 150)
    if (
      lowerUrl.includes('googlevideo.com') ||
      lowerUrl.includes('piped') ||
      lowerUrl.includes('kavin.rocks') ||
      lowerUrl.includes('projectsegfau.lt') ||
      lowerUrl.includes('private.coffee') ||
      lowerUrl.includes('adminforge.de') ||
      lowerUrl.includes('garudalinux.org') ||
      lowerUrl.includes('litesync.org')
    ) {
      delete requestHeaders['Origin'];
      delete requestHeaders['origin'];
      delete requestHeaders['Referer'];
      delete requestHeaders['referer'];
    }

    callback({ requestHeaders });
  });

  // Bypass CORS for audio stream responses — allows MediaElementAudioSourceNode to work
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // If the request is from the YouTube iframe player itself, let it pass unmodified to prevent credentials/CORS conflicts
    if (
      details.url.includes('youtube.com') ||
      details.url.includes('googlevideo.com')
    ) {
      if (details.referrer && details.referrer.includes('youtube.com')) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
    }

    const responseHeaders = {};
    for (const [key, value] of Object.entries(details.responseHeaders)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== 'access-control-allow-origin' &&
        lowerKey !== 'access-control-allow-headers' &&
        lowerKey !== 'access-control-allow-methods'
      ) {
        responseHeaders[key] = value;
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
    callback({ responseHeaders });
  });

  // Log renderer console messages to main process terminal
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer LOG] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    const http = require('http');
    const fs = require('fs');

    const server = http.createServer((req, res) => {
      let safePath = decodeURIComponent(req.url.split('?')[0]);
      if (safePath === '/') safePath = '/index.html';

      const filePath = path.join(__dirname, 'dist', safePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentTypeMap = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.json': 'application/json',
      };
      const contentType = contentTypeMap[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`Local static server running on http://127.0.0.1:${port}`);
      win.loadURL(`http://127.0.0.1:${port}`);
    });

    app.on('will-quit', () => {
      server.close();
    });
  }

  // Print HTML DOM and computed styles to console after 3 seconds to inspect what rendered
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const bodyStyle = await win.webContents.executeJavaScript(`
          (() => {
            const el = document.body;
            if (!el) return 'No body';
            const style = window.getComputedStyle(el);
            return JSON.stringify({
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              width: style.width,
              height: style.height,
              backgroundColor: style.backgroundColor,
              color: style.color
            });
          })()
        `);
        const layoutStyle = await win.webContents.executeJavaScript(`
          (() => {
            const el = document.querySelector('.app-layout');
            if (!el) return 'No layout';
            const style = window.getComputedStyle(el);
            return JSON.stringify({
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              width: style.width,
              height: style.height,
              gridTemplateColumns: style.gridTemplateColumns,
              gridTemplateRows: style.gridTemplateRows
            });
          })()
        `);
        const childrenStyles = await win.webContents.executeJavaScript(`
          (() => {
            const layout = document.querySelector('.app-layout');
            if (!layout) return 'No layout';
            const results = [];
            for (const child of layout.children) {
              const style = window.getComputedStyle(child);
              results.push({
                tagName: child.tagName,
                className: child.className,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                width: style.width,
                height: style.height,
                background: style.background,
                color: style.color
              });
            }
            return JSON.stringify(results);
          })()
        `);
        console.log(`[Renderer Styles] Body: ${bodyStyle}`);
        console.log(`[Renderer Styles] Layout: ${layoutStyle}`);
        console.log(`[Renderer Styles] Children: ${childrenStyles}`);
      } catch (err) {
        console.error('Failed to get styles:', err);
      }
    }, 3000);
  });

  // Prevent new windows from opening (YouTube links etc.)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// IPC handler to extract direct YouTube audio stream locally using yt-dlp
ipcMain.handle('get-stream-url', async (event, videoId) => {
  return new Promise((resolve) => {
    const ytDlpPath = '/opt/homebrew/bin/yt-dlp';
    // Run yt-dlp with the absolute path from Homebrew installation
    exec(`"${ytDlpPath}" -g -f ba "https://www.youtube.com/watch?v=${videoId}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[yt-dlp absolute path error]: ${error.message}`);
        // Fallback to searching PATH in case it's in another location
        exec(`yt-dlp -g -f ba "https://www.youtube.com/watch?v=${videoId}"`, (err2, stdout2) => {
          if (err2) {
            console.error(`[yt-dlp PATH fallback error]: ${err2.message}`);
            resolve(null);
          } else {
            resolve(stdout2.trim());
          }
        });
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
