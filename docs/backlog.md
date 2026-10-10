# Backlog

## Firefox: still to check by hand

She uses Firefox, where recognition runs fast for her (WebGPU). Checked with
Playwright's Firefox (156, headless, WebGPU blocklisted, so on WASM): models
ready in ~30 s, ~10 s per photo, drag and drop, review and zip export/import
all work. Still to check in her real Firefox:

- The "store data persistently?" prompt from `navigator.storage.persist()`
  (automation never shows it).
- Dragging from the Photos app (reported working by hand).

## iPhone

Not a target for now; the app is used on a laptop. Later: check the phone
layout end to end, Safari on iOS, adding photos from the camera roll, and
whether the ~300 MB model download is acceptable on a phone.
