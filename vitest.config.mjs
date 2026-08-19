/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Vitest uses this config in preference to vite.config.mjs (the app build config),
// so the production build and the test runner stay isolated from each other.
export default defineConfig({
	plugins: [vue()],
	test: {
		// Co-locate specs next to the code they cover: src/**/*.spec.js.
		include: ['src/**/*.{test,spec}.js'],
		environment: 'jsdom',
		environmentOptions: {
			jsdom: {
				url: 'http://localhost',
			},
		},
		// lcov is what a codecov CI step would upload; text prints a summary locally.
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
		},
		setupFiles: ['src/test-setup.js'],
		server: {
			deps: {
				// @nextcloud/vue ships untranspiled CSS imports; inline it so jsdom can load components.
				inline: ['@nextcloud/vue'],
			},
		},
	},
})
