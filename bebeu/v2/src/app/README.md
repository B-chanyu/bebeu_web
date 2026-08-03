# Frontend Source Layout

`public/app.js` is generated from these files by `npm run build:app`.

Edit the files in this directory, then rebuild.

## Files

- `00-config-state-dom.js`: constants, global state, DOM references, catalogs
- `10-api-core.js`: API helpers, loading, persistence, base rendering helpers
- `20-chat-auth.js`: chat, login, admin auth, cafe settings submit
- `30-me-attendance-notes.js`: my page, attendance, payroll, notes
- `40-orders-list-detail.js`: work/done lists, order cards, detail views, photo boards
- `50-settings-share.js`: SMS templates, customer share, settings, trash
- `60-events-actions.js`: click handlers, order actions, selection, lightbox, dialogs
- `70-photo-chat-upload.js`: photo preparation, upload, chat send/transfer
- `80-order-parser-forms.js`: paste parser, product form helpers, order form helpers
- `90-bootstrap-events.js`: form submit handlers, document listeners, service worker bootstrap

The current app still shares one browser runtime scope because it is a vanilla PWA.
This split keeps the deployment simple while making feature-level editing easier.
