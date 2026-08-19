<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Agent Guidelines for Employee Portal

This file is scoped to `apps-extra/employee_portal`. The repository-wide
[AGENTS.md](../../AGENTS.md) still applies in full (commit format, DCO, license
headers, security reporting) — this file only adds what's specific to this app.

## What this app is

A SharePoint-style intranet: `.md` files in a single top-level `EmployeePortal`
folder in the user's Nextcloud storage, browsable and editable from one Vue view.

## The one architectural rule that matters

**The app has no permission system of its own.** Every read/write goes through
`\OCP\Files` (`IRootFolder` → `Folder`/`File`), which throws
`NotPermittedException` when the user can't do something. `PageController` only
translates that exception into a `403` — it never checks permissions itself. If
you're tempted to add an "is this user allowed to..." check anywhere, that's a
sign the change belongs in a share/permission adjustment instead, not in this
app's code.

This was verified end-to-end, not just asserted: sharing the `EmployeePortal`
folder read-only with a second user and hitting the API as them produces `200`
with `writable: false` on reads and `403` straight from the Files layer on
writes. See the "Testing the permission model" section below to redo that check
after any change to `PageService`.

## Layout

- `lib/Service/PageService.php` — all Files-API I/O. `PORTAL_FOLDER` /
  `PAGE_EXTENSION` constants live here. `validatePath()` is **path validation
  only** (must be a slash-free `.md` name) — it is not an access check.
  `content` is a fully opaque string end to end — the service never parses it,
  which is what let the row/column/webpart page builder ship as a pure
  frontend change (see below).
- `lib/Controller/PageController.php` — OCS controller, three routes via
  `#[ApiRoute]` attributes (no `appinfo/routes.php` needed — Nextcloud's router
  scans `lib/Controller/*Controller.php` for attributes). Exception → status
  code mapping only.
- `lib/Controller/ViewController.php` — serves the Vue mount point via
  `#[FrontpageRoute]`.
- `src/App.vue` — top-level shell: navigation list, new-page dialog, and
  switching between `PageLayoutViewer`/`PageLayoutEditor` for the current page.
- `src/layout.js` — the page builder's data model as pure functions: a page's
  `content` string is either a JSON layout (`{ version, rows: [{ columns: [{
  webparts }] }] }`, max 3 columns per row) or, for pages not yet touched by
  the builder, legacy markdown (`parseLayout()` sniffs which). Editing a
  legacy page upgrades it via `convertMarkdownToLayout()` — nothing is
  migrated until the user saves. No Vue imports here on purpose, so this file
  stays trivially unit-testable (`layout.spec.js`).
- `src/markdown.js` — the shared `MarkdownIt` + DOMPurify renderer, used by
  the legacy-markdown view path and by the legacy-upgrade conversion.
- `src/PageLayoutViewer.vue` / `src/PageLayoutEditor.vue` — render a layout
  read-only or with add/remove/move-row and column-count controls.
- `src/webparts/registry.js` — maps a webpart's `type` to its edit/view
  components. Only `richtext` exists today (Tiptap-based,
  `src/webparts/richtext/`) — this map is the seam for adding another type.
- `src/services/pages.js` — the three API calls, via `generateOcsUrl`.

Deliberately out of scope for now (see `README.md`): subfolders, Text app
integration, dashboard widgets, search, Groupfolders, column width ratios,
drag-and-drop reordering. `validatePath()` rejecting any path with a `/` is
what currently rules out subfolders — that's the line to move if hierarchy
gets implemented.

## Build toolchain — known gotchas

- **Pin `typescript` to `^6.x` in devDependencies.** `vue@3.5.x` pulls in
  `typescript@7.x` as a transitive/optional peer, and `vite-plugin-dts` (via
  `@nextcloud/vite-config`) dedupes onto it. Volar can't drive the TS 7 API,
  so config loading crashes with `Cannot read properties of undefined
  (reading 'useCaseSensitiveFileNames')` — happens before any app code runs,
  so the stack trace is misleading. Confirm with `npm ls typescript`; every
  entry should resolve to `6.x`.
- **Match `@nextcloud/vite-config`'s vite peer exactly.** `vite-config@2.5.4`
  peer-requires `vite: ^7.3.6`. Don't "align" versions down to what an
  unrelated `apps-extra` app happens to pin without checking its
  `peerDependencies` first.
- No node/npm on the host by default — use nvm (`nvm install 24 && nvm use
  24`), matching the repo root's `"node": "^24.0.0"` / `"npm": "^11.3.0"`
  engines pin.
- `npm install` will warn about blocked install scripts (`esbuild`,
  `@parcel/watcher`, `core-js`). The build works without approving them —
  esbuild resolves its platform binary as an optional dependency regardless.
  Only run `npm approve-scripts esbuild` if the build actually fails asking
  for it.

## Dev workflow

```sh
nvm use 24
npm install
npm run watch    # rebuilds on save, ~1-2s
```

There is no HMR / dev server with this toolchain — `@nextcloud/vite-config`
only wires up build and rebuild-on-watch, not a vite dev server or an HMR
client. Wiring one up would mean `ViewController` conditionally pointing at a
`localhost:5173` script tag and loosening CSP for that origin — a dev-only
branch not worth it for this app's size.

**The JS bundle is cached for 6 months with no cache-busting query string** on
its script tag. A plain browser refresh after a rebuild can silently serve the
stale bundle. Open DevTools → Network → check **Disable cache** and leave
DevTools open while iterating; then a normal refresh always picks up the
latest build.

PHP changes take effect on refresh, no build step. The one exception: adding
or renaming an `#[ApiRoute]`/`#[FrontpageRoute]` needs the app bounced, since
attribute routes are cached:

```sh
docker exec -u www-data master-nextcloud-1 php /var/www/html/occ app:disable employee_portal
docker exec -u www-data master-nextcloud-1 php /var/www/html/occ app:enable employee_portal
```

## Local dev instance

This repo is bind-mounted into `master-nextcloud-1` (see
`nextcloud-docker-dev/docker-compose.yml`). App path inside the container:
`/var/www/html/apps-extra/employee_portal`. Default users: `admin`/`admin`,
plus `alice`/`bob`/`jane`/`john`/`user1`-`user4` with matching passwords —
useful for permission testing without creating throwaway accounts.

URL: `http://nextcloud.local/apps/employee_portal/` (note: **not** the same
prefix as the static JS, which is served from `/apps-extra/employee_portal/js/…`
because this app lives in `apps-extra`, not `apps`).

## Testing the API directly

OCS endpoints, no browser needed:

```sh
docker exec master-nextcloud-1 curl -s -u admin:admin \
  -H "OCS-APIRequest: true" -H "Accept: application/json" \
  "http://localhost/ocs/v2.php/apps/employee_portal/api/v1/pages"
```

`PUT` needs `-X PUT -H "Content-Type: application/json" -d '{"content":"..."}'`.

## Testing the permission model

This is the check that actually matters for this app — redo it after any
`PageService` change:

```sh
# Share EmployeePortal read-only with alice
docker exec master-nextcloud-1 curl -s -u admin:admin -X POST \
  -H "OCS-APIRequest: true" -H "Accept: application/json" \
  -d "path=/EmployeePortal&shareType=0&shareWith=alice&permissions=1" \
  "http://localhost/ocs/v2.php/apps/files_sharing/api/v1/shares"

# As alice: GET should be 200 with writable:false, PUT should be 403 —
# straight from \OCP\Files, not from anything in this app's code.
```

Delete the share afterwards (`DELETE .../shares/<id>`) — don't leave test
shares on the dev instance.

## PHP linting without a local PHP install

No `php` binary on the host either; lint through the container:

```sh
docker exec master-nextcloud-1 sh -c \
  'cd /var/www/html/apps-extra/employee_portal && find . -name "*.php" -not -path "./vendor/*" -not -path "./vendor-bin/*" -print0 | xargs -0 -n1 php -l'
```

## Automated tests

PHP (PHPUnit, mirrors the `recommendations` app's setup):

```sh
docker exec -w /var/www/html/apps-extra/employee_portal master-nextcloud-1 composer install
docker exec -w /var/www/html/apps-extra/employee_portal master-nextcloud-1 composer test:unit
```

`tests/Unit/Service/PageServiceTest.php` and `tests/Unit/Controller/PageControllerTest.php`
mock `\OCP\Files` directly (`IRootFolder`/`Folder`/`File`) — no server bootstrap needed, since
this app's OCP surface has no `OC\Hooks\Emitter`-style dependencies to work around.

JS (Vitest):

```sh
nvm use 24
npm test              # watch mode
npm run test:coverage # single run with coverage
```

`src/services/pages.spec.js` covers the API wrapper. `src/App.spec.js` mounts the real
`App.vue` with `@nextcloud/vue` components (only `NcDialog` is stubbed, since it teleports
and animates in a way jsdom doesn't handle well) — `src/test-setup.js` provides the
`#skip-actions` teleport target and a `matchMedia` stub that `NcContent` and friends need
to mount at all in jsdom.

## Still missing

No `eslint.config.js` yet, so `src/` is unlinted beyond what Vite's own
`@vue/compiler-sfc` warns about at build time.
