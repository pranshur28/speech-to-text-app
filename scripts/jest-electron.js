// Run Jest inside Electron's bundled Node.js.
// Native modules (better-sqlite3, uiohook) are compiled for Electron by the postinstall step,
// so they fail to load under the system Node version. Running Jest as Electron-in-Node-mode
// uses the matching ABI without rebuilding anything.
const { spawnSync } = require('child_process');
const path = require('path');

const electronPath = require('electron'); // resolves to the Electron binary when required from Node
const jestBin = path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');

const result = spawnSync(electronPath, [jestBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

process.exit(result.status ?? 1);
