# Backlog

## Test on Firefox

She uses Firefox (no Chromium browser), and it seems to work, but nothing has
been tested there systematically. Check on macOS Firefox:

- Whether WebGPU is available. Without it background removal runs on WASM, about
  8 s per photo instead of 0.3 s.
- The "store data persistently?" prompt from `navigator.storage.persist()`.
- Dragging photos from Finder and from the Photos app.
- Zip backup export and import.
