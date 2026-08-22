/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import NewsGridWebpartEdit from './NewsGridWebpartEdit.vue'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text) => text,
}))

describe('NewsGridWebpartEdit', () => {
	it('emits update:data with allNewsLink updated and items preserved unchanged', async () => {
		const items = [{ title: 'Q3 all-hands recap' }]
		const wrapper = mount(NewsGridWebpartEdit, { props: { data: { items, allNewsLink: '' } } })

		const input = wrapper.get('input')
		await input.setValue('https://example.com/news')

		expect(wrapper.emitted('update:data')).toBeTruthy()
		const [lastEmit] = wrapper.emitted('update:data').at(-1)
		expect(lastEmit).toEqual({ items, allNewsLink: 'https://example.com/news' })
	})
})
