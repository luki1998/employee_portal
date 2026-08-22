/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The type a blank row/webpart starts as. 'richtext' is grandfathered as the
 * one reserved unscoped type name - see CONTEXT.md.
 */
export const DEFAULT_TYPE = 'richtext'

/**
 * Maps a Webpart type to a factory for its default `data` payload. Framework-free
 * on purpose: `layout.js` needs this to create new Webpart instances without
 * depending on the Vue-bearing component registry - see webparts/registry.js,
 * which composes this same map into its own per-type contract.
 */
export const webpartDefaults = {
	[DEFAULT_TYPE]: () => ({ html: '' }),
}
