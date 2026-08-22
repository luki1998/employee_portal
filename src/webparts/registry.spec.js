/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it, vi } from 'vitest'
import { webpartDefaults } from './defaults.js'
import { webpartTypes } from './registry.js'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text) => text,
}))

describe('webpartTypes', () => {
	it('exposes the same default-data factory as webpartDefaults for every type, on both sides', () => {
		expect(Object.keys(webpartTypes).sort()).toEqual(Object.keys(webpartDefaults).sort())

		for (const type of Object.keys(webpartTypes)) {
			expect(webpartTypes[type].defaultData).toBe(webpartDefaults[type])
		}
	})
})
