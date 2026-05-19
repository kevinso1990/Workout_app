const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Block Metro from resolving files inside non-source directories.
// IMPORTANT: patterns like /dist/ are too broad — they match dist/ folders
// inside node_modules packages. Only block paths that are anchored to the
// project root so package internals are never accidentally excluded.
const root = __dirname.replace(/\\/g, '/');

const exclusions = [
  // .local — Replit skills/artifacts; contains stale temp dirs that can crash
  // Metro's FallbackWatcher when they disappear between runs.
  new RegExp(`^${root}/\\.local/`),
  new RegExp(`^${root}/\\.git/`),
  new RegExp(`^${root}/\\.upm/`),
  new RegExp(`^${root}/attached_assets/`),
  new RegExp(`^${root}/load-tests/`),
];

config.resolver = {
  ...config.resolver,
  blockList: exclusions,
};

module.exports = config;
