#!/bin/bash
set -e

# Install/update npm dependencies after a task merge.
# Migrations run automatically when the backend starts (initDb), so no
# explicit migration step is needed here.
npm install --no-audit --no-fund --prefer-offline

# Patch expo-video 55: native VideoPlayer constructor only accepts 2 args in
# Expo Go, but the JS wrapper always passes 3 (undefined as 3rd arg counts in
# Hermes/JSI). Guard the call so the 3rd arg is omitted when not provided.
node -e "
const fs = require('fs');
const path = 'node_modules/expo-video/build/VideoPlayer.js';
let src = fs.readFileSync(path, 'utf8');
const bad = 'return new NativeVideoModule.VideoPlayer(parsedSource, false, playerBuilderOptions);';
const good = \`return playerBuilderOptions !== undefined
        ? new NativeVideoModule.VideoPlayer(parsedSource, false, playerBuilderOptions)
        : new NativeVideoModule.VideoPlayer(parsedSource, false);\`;
if (src.includes(bad)) {
  fs.writeFileSync(path, src.replaceAll(bad, good));
  console.log('expo-video patch applied');
} else {
  console.log('expo-video already patched or changed upstream');
}
"
