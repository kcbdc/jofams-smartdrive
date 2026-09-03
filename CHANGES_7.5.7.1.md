# JOFAMS NAVI 7.5.7.1 Hotfix

- Restored missing renderProfile() and logout() functions.
- Prevented one initialization failure from disabling all UI bindings.
- Added cache-busting query strings for app.js/styles.css/config.js.
- Updated Service Worker cache and removed index/app.js/styles.css from install-time precache to prevent mixed-version boot.
- Existing 7.5.7 route/GPS/AR/tunnel changes retained.
