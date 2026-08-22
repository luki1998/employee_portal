/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import NcButton from '@nextcloud/vue/components/NcButton'
import { createEmptyLayout } from './layout.js'
import PageLayoutEditor from './PageLayoutEditor.vue'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (match, key) => vars[key]) : text),
}))

// RichTextWebpartEdit mounts a real Tiptap/ProseMirror editor, which relies on
// contenteditable/selection APIs jsdom doesn't fully implement - see App.spec.js.
const mountOptions = {
	global: {
		stubs: {
			RichTextWebpartEdit: {
				props: ['data'],
				template: '<textarea class="richtext-stub" :value="data.html" />',
			},
		},
	},
}

// NcButton's internal click handler applies a `.prevent` modifier, which
// requires a real (or event-shaped) argument - see App.spec.js.
const clickEvent = { preventDefault: () => {} }

/**
 * Finds an NcButton within a wrapper by its aria-label or default-slot text.
 *
 * @param wrapper A mounted wrapper or a scoped element wrapper to search within
 * @param label The button's aria-label or visible text
 */
function findButton(wrapper, label) {
	return wrapper.findAllComponents(NcButton).find((button) => button.props('ariaLabel') === label || button.text() === label)
}

describe('PageLayoutEditor', () => {
	it('adds a row via the "Add row" button', async () => {
		const layout = createEmptyLayout()
		const wrapper = mount(PageLayoutEditor, { ...mountOptions, props: { modelValue: layout } })

		await findButton(wrapper, 'Add row').vm.$emit('click', clickEvent)

		expect(layout.rows).toHaveLength(2)
		expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([layout])
	})

	it('emits update:activeRowId when a row\'s settings gear is clicked', async () => {
		const layout = createEmptyLayout()
		const wrapper = mount(PageLayoutEditor, { ...mountOptions, props: { modelValue: layout } })

		await findButton(wrapper, 'Row settings').vm.$emit('click', clickEvent)

		expect(wrapper.emitted('update:activeRowId')).toEqual([[layout.rows[0].id]])
	})

	it('marks the active row with a class for styling', () => {
		const layout = createEmptyLayout()
		const wrapper = mount(PageLayoutEditor, { ...mountOptions, props: { modelValue: layout, activeRowId: layout.rows[0].id } })

		expect(wrapper.get('.page-layout-editor__row').classes()).toContain('page-layout-editor__row--active')
	})

	it('renders the grid using the row\'s width ratio', () => {
		const layout = createEmptyLayout()
		layout.rows[0].columns.push({ id: 'col-2', webparts: [] })
		layout.rows[0].widths = [1, 2]
		const wrapper = mount(PageLayoutEditor, { ...mountOptions, props: { modelValue: layout } })

		expect(wrapper.get('.page-layout-editor__grid').attributes('style')).toContain('grid-template-columns: 1fr 2fr')
	})

	it('adds and removes a webpart within a column', async () => {
		const layout = createEmptyLayout()
		const wrapper = mount(PageLayoutEditor, { ...mountOptions, props: { modelValue: layout } })

		await findButton(wrapper, 'Add text').vm.$emit('click', clickEvent)
		expect(layout.rows[0].columns[0].webparts).toHaveLength(2)

		await findButton(wrapper, 'Remove').vm.$emit('click', clickEvent)
		expect(layout.rows[0].columns[0].webparts).toHaveLength(1)
	})

})
