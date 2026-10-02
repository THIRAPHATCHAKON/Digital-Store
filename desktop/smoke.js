// npm run smoke: boots the real main.js, screenshots the first page and fails if the site did not load.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
require('./main.js');

app.whenReady().then(() => {
  const wc = BrowserWindow.getAllWindows()[0].webContents;
  wc.once('did-finish-load', async () => {
    await new Promise((r) => setTimeout(r, 2000)); // fonts and hydration
    const out = path.join(__dirname, 'smoke.png');
    fs.writeFileSync(out, (await wc.capturePage()).toPNG());
    const url = wc.getURL();
    console.log(`${url} -> ${out}`);
    app.exit(url.startsWith('https://') ? 0 : 1); // file:// means main.js fell back to offline.html
  });
});
