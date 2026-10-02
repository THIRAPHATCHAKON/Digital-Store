// npm run icon: draws the ◆ from the site header on the accent colour and saves build/icon.png.
// electron-builder picks that file up as the .exe and installer icon.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const html = `<body style="margin:0">
  <div style="width:512px;height:512px;border-radius:112px;background:#4f46e5;display:grid;place-items:center">
    <div style="width:200px;height:200px;border-radius:26px;background:#fff;transform:rotate(45deg)"></div>
  </div>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true });
  const painted = new Promise((r) => win.once('ready-to-show', r)); // capturePage rejects until a first frame exists
  await win.loadURL('data:text/html,' + encodeURIComponent(html));
  await painted;
  const out = path.join(__dirname, 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // resize: on a scaled display the capture comes back larger than 512
  fs.writeFileSync(out, (await win.webContents.capturePage()).resize({ width: 512, height: 512 }).toPNG());
  app.quit();
});
