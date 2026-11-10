# Accessibility

Rowhouse targets **WCAG 2.2 Level AA** for the public site and signed-in studio.

## What was tested

- Anonymous routes: home (including sync-locked), discover (default, filtered, empty), film, track (including manual sync), creator (with and without tracks), live index and rooms (live, ended, scheduled), about, contact, privacy, 404, studio signed-out
- Signed-in routes: home, studio (idle, validation errors, film search), live room (chat/reactions and manual lock), own creator profile
- Automated: axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` at 1440×900, 390×844, and 320×800
- Manual (code and keyboard pass): skip link, visible focus ring, landmarks and headings, breadcrumb and filter state, waveform slider name/role/value, sync status live region, reflow at 320 px, play control accessible name matching visible label

## Known limitations

- Live rooms depend on a signed-in session and a running API for chat and reactions; the UI announces sync lock state, but real-time WebSocket failure modes are not separately audited here
- Film poster art is decorative or titled via adjacent text; some catalog images remain low-contrast as artwork rather than UI chrome
- Third-party OAuth (Google) is out of scope for this pass; local `ALLOW_DEV_LOGIN` was used for signed-in audits only

## Report a barrier

Open an issue at https://github.com/KarthikSubramanian07/rowhouse/issues or use the contacts on `/contact`.
