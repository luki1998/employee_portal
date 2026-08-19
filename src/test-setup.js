/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Global setup run once before the test suite (see `setupFiles` in vitest.config.mjs).

// NcContent teleports a skip-navigation link to #skip-actions, which normally lives in
// the Nextcloud page shell. Provide the target so mounting NcContent doesn't crash.
const skipActions = document.createElement('div')
skipActions.id = 'skip-actions'
document.body.appendChild(skipActions)

// jsdom does not implement matchMedia, but several @nextcloud/vue components call it
// on mount. Provide a no-op stub so component tests don't crash.
if (!window.matchMedia) {
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {}, // deprecated, kept for older consumers
		removeListener: () => {}, // deprecated
		dispatchEvent: () => false,
	})
}
