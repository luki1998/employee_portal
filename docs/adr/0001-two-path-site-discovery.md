<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Site discovery has two paths, not one

Sites live as subfolders of the portal folder, and access to the portal
folder itself is deliberately kept to a narrow "Site creator" group so that
being able to create a Site never implies read access to every other Site
(see [CONTEXT.md](../../CONTEXT.md)). That means an ordinary Site member —
someone given access to one Site but not to the portal folder — cannot
discover their Sites by listing the portal folder's children; they don't have
permission to list it at all.

We considered instead granting everyone in the portal at least read/list
access to the portal folder, so a single "list its children" call would
always work. We rejected that: Nextcloud sharing grants access to a folder's
whole subtree, so any read access on the portal folder would cascade into
read access on every Site inside it, making genuine per-Site isolation
impossible — exactly the property this feature exists to provide.

Instead, `PageService` (or its successor) resolves Sites two ways depending
on what the current user can reach: Site creators list the portal folder's
children directly; everyone else's Sites are discovered via folders shared
directly with them, filtered to ones that structurally sit inside the
canonical portal folder (checked via the node's actual origin, not by
browsing the parent). A directly-shared folder that isn't really inside the
portal folder is not treated as a Site.
