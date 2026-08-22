/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PageLayoutViewer from './PageLayoutViewer.vue'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text) => text,
}))

describe('PageLayoutViewer', () => {
	it('renders each row as a grid with one cell per column', () => {
		const layout = {
			version: 1,
			rows: [
				{
					id: 'row-1',
					columns: [
						{ id: 'col-1', webparts: [{ id: 'wp-1', type: 'richtext', html: '<p>Left</p>' }] },
						{ id: 'col-2', webparts: [{ id: 'wp-2', type: 'richtext', html: '<p>Right</p>' }] },
					],
				},
			],
		}

		const wrapper = mount(PageLayoutViewer, { props: { layout } })

		const row = wrapper.get('.page-layout__row')
		expect(row.attributes('style')).toContain('grid-template-columns: 1fr 1fr')
		expect(wrapper.findAll('.page-layout__column')).toHaveLength(2)
		expect(wrapper.text()).toContain('Left')
		expect(wrapper.text()).toContain('Right')
	})

	it('applies a non-equal width ratio when the row has one', () => {
		const layout = {
			version: 1,
			rows: [
				{
					id: 'row-1',
					widths: [1, 2],
					columns: [
						{ id: 'col-1', webparts: [] },
						{ id: 'col-2', webparts: [] },
					],
				},
			],
		}

		const wrapper = mount(PageLayoutViewer, { props: { layout } })

		expect(wrapper.get('.page-layout__row').attributes('style')).toContain('grid-template-columns: 1fr 2fr')
	})

	it('shows a placeholder for an unregistered webpart type, preserving its raw data', () => {
		const webpart = { id: 'wp-1', type: 'unknown-type', data: { foo: 'bar' } }
		const layout = {
			version: 1,
			rows: [{ id: 'row-1', columns: [{ id: 'col-1', webparts: [webpart] }] }],
		}

		const wrapper = mount(PageLayoutViewer, { props: { layout } })

		expect(wrapper.get('.webpart-instance__placeholder--unregistered').exists()).toBe(true)
		expect(webpart.data).toEqual({ foo: 'bar' })
	})
})
