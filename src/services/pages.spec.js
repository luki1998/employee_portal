/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPage, fetchPages, savePage } from './pages.js'

vi.mock('@nextcloud/axios', () => ({
	default: {
		get: vi.fn(),
		put: vi.fn(),
	},
}))

function ocsResponse(data) {
	return { data: { ocs: { data } } }
}

describe('pages service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('fetchPages', () => {
		it('requests the Site\'s pages collection and unwraps the OCS envelope', async () => {
			const pages = [{ path: 'General/welcome.md', title: 'welcome' }]
			axios.get.mockResolvedValue(ocsResponse(pages))

			const result = await fetchPages('General')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/apps\/employee_portal\/api\/v1\/sites\/General\/pages$/))
			expect(result).toBe(pages)
		})

		it('URL-encodes the site name', async () => {
			axios.get.mockResolvedValue(ocsResponse([]))

			await fetchPages('My Site')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/sites\/My%20Site\/pages$/))
		})
	})

	describe('fetchPage', () => {
		it('requests the single page URL and unwraps the OCS envelope', async () => {
			const page = { path: 'welcome.md', title: 'welcome', content: '# Hi' }
			axios.get.mockResolvedValue(ocsResponse(page))

			const result = await fetchPage('welcome.md')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/pages\/welcome\.md$/))
			expect(result).toBe(page)
		})

		it('URL-encodes the path', async () => {
			axios.get.mockResolvedValue(ocsResponse({}))

			await fetchPage('my notes.md')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/pages\/my%20notes\.md$/))
		})
	})

	describe('savePage', () => {
		it('PUTs the content to the page URL and unwraps the OCS envelope', async () => {
			const page = { path: 'welcome.md', title: 'welcome' }
			axios.put.mockResolvedValue(ocsResponse(page))

			const result = await savePage('welcome.md', '# Hello world')

			expect(axios.put).toHaveBeenCalledWith(
				expect.stringMatching(/\/pages\/welcome\.md$/),
				{ content: '# Hello world' },
			)
			expect(result).toBe(page)
		})
	})
})
