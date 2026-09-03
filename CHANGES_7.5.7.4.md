# 7.5.7.4 Web Runtime Hotfix

- UI event binding is isolated by section so one missing/failed control cannot disable the whole page.
- Future-departure UI binding is independently fault-tolerant.
- Existing JOFAMS service workers and stale caches are removed to prevent mixed index/app.js versions.
- index.html, app.js, config.js, sw.js are served no-store.
- Global runtime/unhandled-promise diagnostics added.
- Existing 7.5.7.3 Google OAuth configuration and 7.5.7.2 AR/GPS/permission work retained.
