<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Employee Portal

A wiki-style intranet built on top of a Nextcloud folder tree, where access to
content is decided entirely by Nextcloud's own file/sharing permissions rather
than by any permission system this app maintains itself.

## Language

**Portal folder**:
The single top-level folder (named `EmployeePortal`) that holds every Site. It
is a pure container — it holds no pages of its own, only Site folders.

**Site**:
An immediate subfolder of the portal folder. A Site is the unit of
permissioning: access to it is decided by whatever Nextcloud sharing exists on
that specific subfolder, independent of any other Site. Modelled after a
SharePoint Site (the user's own term for it), though this app does not model
SharePoint's separate "Site Collection" concept — one folder is one Site, full
stop, with no nesting of Sites inside Sites.
_Avoid_: Site Collection, folder (when a Site is meant specifically)

**Page**:
A markdown (`.md`) file inside a Site folder. Pages do not nest — a Site holds
pages directly, with no further subfolder levels underneath it.

**Site creator**:
Someone with write access to the portal folder itself, and therefore able to
create new Sites. Deliberately a narrow group, not every portal user — kept
narrow so that write access to the portal folder never implies read access to
every Site's content. A Site creator's access to a specific Site's content,
beyond having created it, is decided the same way anyone else's is: by
whatever sharing exists on that Site folder. In practice, because Nextcloud
sharing grants access to a folder's whole subtree, a Site creator can always
at least read into every Site regardless of whether anyone shared a given Site
with them individually — narrow write access to the portal folder does not
buy isolation between Sites for this group, only between this group and
everyone else.

**Site member**:
Someone with access to a specific Site, granted by a direct share of that
Site's folder rather than any access to the portal folder itself. A Site
member cannot browse the portal folder to discover other Sites — the Sites
they can see are exactly the ones directly shared with them.

**Webpart type**:
A registered, installable *kind* of Webpart — what defines how a Webpart
behaves and renders, independent of any particular Page. `richtext` and
`newsgrid` are the types registered today (see `webparts/registry.js`); the
plugin work this app is heading toward is about letting more Webpart types
exist, including ones an instance admin installs themselves rather than ones
bundled with this app.
_Avoid_: Widget type, widget definition

**Webpart instance**:
One placement of a Webpart type on a specific Page — the thing that actually
lives in a Column, carrying that placement's own content or configuration
(for a `richtext` instance, its `html`). Usually just called a "Webpart"
when the distinction from its type doesn't matter.
_Avoid_: Widget, widget instance
