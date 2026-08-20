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
			const page = { path: 'General/welcome.md', title: 'welcome', content: '# Hi' }
			axios.get.mockResolvedValue(ocsResponse(page))

			const result = await fetchPage('General/welcome.md')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/pages\/General\/welcome\.md$/))
			expect(result).toBe(page)
		})

		it('joins the Site and page segments with a literal slash, not an encoded one', async () => {
			axios.get.mockResolvedValue(ocsResponse({}))

			await fetchPage('General/welcome.md')

			const [url] = axios.get.mock.calls[0]
			expect(url).not.toContain('%2F')
			expect(url).toMatch(/\/pages\/General\/welcome\.md$/)
		})

		it('URL-encodes the site and page segments independently', async () => {
			axios.get.mockResolvedValue(ocsResponse({}))

			await fetchPage('My Site/my notes.md')

			expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/pages\/My%20Site\/my%20notes\.md$/))
		})

		it('rejects a path without a site/page separator instead of silently mis-splitting it', async () => {
			await expect(fetchPage('welcome.md')).rejects.toThrow('Pages must be addressed as site/page.md')
			expect(axios.get).not.toHaveBeenCalled()
		})
	})

	describe('savePage', () => {
		it('PUTs the content to the page URL and unwraps the OCS envelope', async () => {
			const page = { path: 'General/welcome.md', title: 'welcome' }
			axios.put.mockResolvedValue(ocsResponse(page))

			const result = await savePage('General/welcome.md', '# Hello world')

			expect(axios.put).toHaveBeenCalledWith(
				expect.stringMatching(/\/pages\/General\/welcome\.md$/),
				{ content: '# Hello world' },
			)
			expect(result).toBe(page)
		})

		it('joins the Site and page segments with a literal slash, not an encoded one', async () => {
			axios.put.mockResolvedValue(ocsResponse({}))

			await savePage('General/welcome.md', '# Hello world')

			const [url] = axios.put.mock.calls[0]
			expect(url).not.toContain('%2F')
		})
	})
})
