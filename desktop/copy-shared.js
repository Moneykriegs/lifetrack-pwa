// Copies the shared core (and the developer's local supabase-config.js) into
// renderer/vendor/ so the packaged app is self-contained and the renderer can
// reference everything with plain relative paths (no ../../ escaping the app root).
// Runs automatically before `npm start` and `npm run dist`.
'use strict';
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const vendor = path.join(__dirname, 'renderer', 'vendor');
fs.mkdirSync(vendor, { recursive: true });

const shared = ['constants.js', 'db.js', 'core.js', 'insights.js'];
for (const f of shared) {
  fs.copyFileSync(path.join(repoRoot, 'shared', f), path.join(vendor, f));
}

// supabase-config.js is gitignored — copy the dev's local copy if present.
const cfg = path.join(repoRoot, 'supabase-config.js');
if (fs.existsSync(cfg)) {
  fs.copyFileSync(cfg, path.join(vendor, 'supabase-config.js'));
} else {
  // Write a stub so the renderer loads in local-only mode without erroring.
  fs.writeFileSync(
    path.join(vendor, 'supabase-config.js'),
    '// No supabase-config.js found at build time — cloud sync disabled (local-only mode).\n' +
    'window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || null;\n'
  );
}

console.log('[copy-shared] vendor/ populated:', shared.join(', ') + ', supabase-config.js');
