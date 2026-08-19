/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSite, fetchSites } from './sites.js'

vi.mock('@nextcloud/axios', () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

function ocsResponse(data) {
	return { data: { ocs: { data } } }
}

describe('sites service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('fetchSites', () => {
		it('requests the sites collection and unwraps the OCS envelope', async () => {
			const sites = [{ name: 'General' }, { name: 'Marketing' }]
			axios.get.mockResolvedValue(ocsResponse(sites))

			const result = await fetchSites()

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/apps\/employee_portal\/api\/v1\/sites$/))
			expect(result).toBe(sites)
		})
	})

	describe('createSite', () => {
		it('POSTs the name to the sites collection and unwraps the OCS envelope', async () => {
			const site = { name: 'Marketing' }
			axios.post.mockResolvedValue(ocsResponse(site))

			const result = await createSite('Marketing')

			expect(axios.post).toHaveBeenCalledWith(
				expect.stringMatching(/\/apps\/employee_portal\/api\/v1\/sites$/),
				{ name: 'Marketing' },
			)
			expect(result).toBe(site)
		})
	})
})
