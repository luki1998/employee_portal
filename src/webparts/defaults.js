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
 * Seed data for a fresh `newsgrid` instance, standing in for real Page-backed
 * retrieval (see spec Out of Scope). Mixes items with and without a
 * `category` and with and without `pinned` so the view's conditional
 * rendering has something to exercise out of the box.
 *
 * @return {object[]}
 */
function createNewsGridItems() {
	return [
		{ title: 'Q3 all-hands recap', excerpt: 'Slides and recording from Thursday\'s all-hands are now available.', author: 'Priya Nair', date: '2026-08-18', category: 'Announcement', pinned: true, views: 482, comments: 12 },
		{ title: 'New parental leave policy', excerpt: 'HR has updated the parental leave policy effective next quarter.', author: 'Jordan Blake', date: '2026-08-15', category: 'HR', pinned: true, views: 356, comments: 27 },
		{ title: 'Office kitchen renovation starts Monday', excerpt: 'Expect limited kitchen access on the 4th floor for about two weeks.', author: 'Sam Ortiz', date: '2026-08-14', category: 'Facilities', pinned: false, views: 198, comments: 4 },
		{ title: 'Welcome our new design hires', excerpt: 'Three new designers are joining the product team this month.', author: 'Priya Nair', date: '2026-08-12', category: 'People', pinned: false, views: 271, comments: 9 },
		{ title: 'Reminder: benefits enrollment closes Friday', excerpt: 'Submit your elections before open enrollment closes this week.', author: 'Jordan Blake', date: '2026-08-10', category: 'HR', pinned: false, views: 340, comments: 6 },
		{ title: 'Coffee with the CEO - sign up now', excerpt: 'A handful of slots are still open for next month\'s informal chat.', author: 'Sam Ortiz', date: '2026-08-08', pinned: false, views: 129, comments: 2 },
	]
}

/**
 * Maps a Webpart type to a factory for its `data` payload. Framework-free on
 * purpose: `layout.js` needs this to create new Webpart instances without
 * depending on the Vue-bearing component registry - see webparts/registry.js,
 * which composes this same map into its own per-type contract. Called with no
 * arguments for a blank instance; richtext's factory also accepts an explicit
 * `html` override, reused by createRichTextWebpart so the {html} data shape
 * has one source of truth.
 */
export const webpartDefaults = {
	[DEFAULT_TYPE]: (html = '') => ({ html }),
	newsgrid: () => ({ items: createNewsGridItems(), allNewsLink: '' }),
}
