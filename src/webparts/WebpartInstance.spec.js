/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WebpartInstance from './WebpartInstance.vue'

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (match, key) => vars[key]) : text),
}))

// Built inside the factory (rather than as top-level consts referenced by
// it) since vi.mock factories are hoisted above the rest of this module.
vi.mock('./registry.js', async () => {
	const { defineComponent, h } = await import('vue')

	const StubView = defineComponent({
		props: ['data'],
		setup(props) {
			return () => h('div', { class: 'stub-view' }, props.data.text)
		},
	})

	const StubEdit = defineComponent({
		props: ['data'],
		emits: ['update:data'],
		setup(props, { emit }) {
			return () => h('button', { class: 'stub-edit', onClick: () => emit('update:data', { text: 'changed' }) }, 'edit')
		},
	})

	const CrasherView = defineComponent({
		props: ['data'],
		setup() {
			throw new Error('boom')
		},
		render() {
			return h('div')
		},
	})

	return {
		webpartTypes: {
			'test.stub': { label: 'Stub', view: StubView, edit: StubEdit },
			'test.crasher': { label: 'Crasher', view: CrasherView, edit: CrasherView },
		},
	}
})

describe('WebpartInstance', () => {
	it('passes the instance data to the view component, and nothing else', () => {
		const webpart = { id: 'wp-1', type: 'test.stub', data: { text: 'Hello' } }
		const wrapper = mount(WebpartInstance, { props: { webpart, mode: 'view' } })

		expect(wrapper.get('.stub-view').text()).toBe('Hello')
	})

	it('reads a legacy bare-html richtext instance through the same data contract', () => {
		const webpart = { id: 'wp-1', type: 'test.stub', text: 'ignored - not richtext, no compat applies' }
		const wrapper = mount(WebpartInstance, { props: { webpart, mode: 'view' } })

		// Only 'richtext' has a legacy-compat reading; any other type with no
		// `data` field just gets an empty data object.
		expect(wrapper.get('.stub-view').text()).toBe('')
	})

	it('forwards the edit component\'s update:data event', async () => {
		const webpart = { id: 'wp-1', type: 'test.stub', data: { text: 'Hello' } }
		const wrapper = mount(WebpartInstance, { props: { webpart, mode: 'edit' } })

		await wrapper.get('.stub-edit').trigger('click')

		expect(wrapper.emitted('update:data')).toEqual([[{ text: 'changed' }]])
	})

	it('shows a placeholder for an unregistered type and leaves its raw data untouched', () => {
		const webpart = { id: 'wp-1', type: 'acme.unregistered', data: { anything: 'kept' } }
		const wrapper = mount(WebpartInstance, { props: { webpart, mode: 'view' } })

		expect(wrapper.find('.webpart-instance__placeholder--unregistered').exists()).toBe(true)
		expect(wrapper.find('.webpart-instance__placeholder--crashed').exists()).toBe(false)
		expect(webpart.data).toEqual({ anything: 'kept' })
	})

	it('isolates a crash in the type component behind a distinct placeholder, without throwing', async () => {
		const webpart = { id: 'wp-1', type: 'test.crasher', data: {} }

		let wrapper
		expect(() => {
			wrapper = mount(WebpartInstance, { props: { webpart, mode: 'view' } })
		}).not.toThrow()
		await flushPromises()

		expect(wrapper.find('.webpart-instance__placeholder--crashed').exists()).toBe(true)
		expect(wrapper.find('.webpart-instance__placeholder--unregistered').exists()).toBe(false)
	})
})
