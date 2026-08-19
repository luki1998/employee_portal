<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Employee Portal

A wiki-style intranet built on top of your Nextcloud files.

Pages are `.md` files in the **EmployeePortal** folder of the user's Nextcloud storage. The
folder is created on first use. A page is built from rows of up to 3 columns each, and each
column holds one or more webparts — for now, a rich text editor is the only webpart. Under the
hood a page's file stores that structure as JSON; a page created before the page builder existed
(or edited outside the app) is treated as plain markdown until it's opened for editing, at which
point it's upgraded into a single richtext webpart the next time it's saved.

## Access control

The app has **no permission model of its own**. Every read and write goes through `\OCP\Files`,
so the storage layer decides what a user may do and throws `NotPermittedException` otherwise.
`PageController` only maps those exceptions onto OCS status codes:

| Situation | Result |
| --- | --- |
| No read access to a page | `403` |
| No write access to a page | `403` |
| Page does not exist | `404` |
| Path is not a markdown file in the portal folder | `400` |

Sharing a page is therefore the same thing as sharing its file.

## API

All endpoints are OCS routes under `/ocs/v2.php/apps/employee_portal/api/v1`.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/pages` | List the pages in the portal folder |
| `GET` | `/pages/{path}` | Markdown source of a page |
| `PUT` | `/pages/{path}` | Save a page, creating it if needed |

## Development

```sh
composer install
npm install
npm run dev     # or: npm run watch
```

## Not implemented yet

Page hierarchy and subfolders, Text app integration, dashboard widgets, search, and Groupfolders
support. `PageService::validatePath()` currently rejects any path containing a slash.
