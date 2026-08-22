/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import NewsGridWebpartView from './NewsGridWebpartView.vue'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text) => text,
}))

const baseItem = {
	title: 'Q3 all-hands recap',
	excerpt: 'Slides and recording are now available.',
	author: 'Priya Nair',
	date: '2026-08-18',
	pinned: false,
	views: 482,
	comments: 12,
}

describe('NewsGridWebpartView', () => {
	it('renders the seeded items', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [baseItem, { ...baseItem, title: 'Second item' }], allNewsLink: '' } },
		})

		const cards = wrapper.findAll('.newsgrid-webpart__card')
		expect(cards).toHaveLength(2)
		expect(cards[0].text()).toContain('Q3 all-hands recap')
		expect(cards[1].text()).toContain('Second item')
	})

	it('omits the category pill when an item has no category', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [{ ...baseItem, category: undefined }], allNewsLink: '' } },
		})

		expect(wrapper.find('.newsgrid-webpart__category').exists()).toBe(false)
	})

	it('shows the category pill when an item has a category', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [{ ...baseItem, category: 'HR' }], allNewsLink: '' } },
		})

		expect(wrapper.get('.newsgrid-webpart__category').text()).toBe('HR')
	})

	it('shows the pinned badge only for pinned items', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: {
				data: {
					items: [
						{ ...baseItem, title: 'Pinned item', pinned: true },
						{ ...baseItem, title: 'Unpinned item', pinned: false },
					],
					allNewsLink: '',
				},
			},
		})

		const cards = wrapper.findAll('.newsgrid-webpart__card')
		expect(cards[0].find('.newsgrid-webpart__pinned').exists()).toBe(true)
		expect(cards[1].find('.newsgrid-webpart__pinned').exists()).toBe(false)
	})

	it('hides the "All news" link when allNewsLink is empty', () => {
		const wrapper = mount(NewsGridWebpartView, { props: { data: { items: [], allNewsLink: '' } } })

		expect(wrapper.find('.newsgrid-webpart__all-news-link').exists()).toBe(false)
	})

	it('shows the "All news" link with the right href when allNewsLink is set', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [], allNewsLink: 'https://example.com/news' } },
		})

		const link = wrapper.get('.newsgrid-webpart__all-news-link')
		expect(link.attributes('href')).toBe('https://example.com/news')
	})

	it('hides the "All news" link for a non-http(s) scheme', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [], allNewsLink: 'javascript:alert(1)' } },
		})

		expect(wrapper.find('.newsgrid-webpart__all-news-link').exists()).toBe(false)
	})

	it('falls back to the raw string for an unparseable date', () => {
		const wrapper = mount(NewsGridWebpartView, {
			props: { data: { items: [{ ...baseItem, date: 'not-a-date' }], allNewsLink: '' } },
		})

		expect(wrapper.get('.newsgrid-webpart__date').text()).toBe('not-a-date')
	})
})
