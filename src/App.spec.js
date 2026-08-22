/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { showError } from '@nextcloud/dialogs'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcAppNavigationNew from '@nextcloud/vue/components/NcAppNavigationNew'
import NcAppSidebar from '@nextcloud/vue/components/NcAppSidebar'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { renderMarkdown } from './markdown.js'
import { fetchPage, fetchPages, savePage } from './services/pages.js'
import { createSite, fetchSites } from './services/sites.js'

vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
}))

vi.mock('@nextcloud/l10n', async (importOriginal) => ({
	...(await importOriginal()),
	t: (app, text) => text,
}))

vi.mock('./services/pages.js', () => ({
	fetchPages: vi.fn(),
	fetchPage: vi.fn(),
	savePage: vi.fn(),
}))

vi.mock('./services/sites.js', () => ({
	fetchSites: vi.fn(),
	createSite: vi.fn(),
}))

// NcDialog teleports its content and animates in/out, which is more trouble
// than it's worth in jsdom. Replace it with a plain element that still
// renders the default slot and exposes the `buttons` prop, so NcTextField
// and the dialog buttons stay testable.
//
// RichTextWebpartEdit mounts a real Tiptap/ProseMirror editor, which relies
// on contenteditable and selection APIs jsdom doesn't fully implement.
// Replace it with a plain textarea that still round-trips the v-model, so
// tests can drive it without depending on ProseMirror's DOM behavior.
const mountOptions = {
	global: {
		stubs: {
			NcDialog: {
				props: ['buttons', 'name'],
				template: '<div><slot /></div>',
			},
			RichTextWebpartEdit: {
				props: ['data'],
				emits: ['update:data'],
				template: '<textarea class="richtext-stub" :value="data.html" @input="$emit(\'update:data\', { html: $event.target.value })" />',
			},
		},
	},
}

/**
 * Build a minimal page fixture, as returned by the API.
 *
 * @param overrides partial page to merge over the defaults
 */
function makePage(overrides = {}) {
	return {
		path: 'welcome.md',
		title: 'welcome',
		fileId: 1,
		mtime: 1000,
		size: 10,
		writable: true,
		...overrides,
	}
}

// NcButton's internal click handler applies a `.prevent` modifier, which
// requires a real (or event-shaped) argument.
const clickEvent = { preventDefault: () => {} }

/**
 * Finds an NcButton anywhere in the wrapper by its aria-label or default-slot
 * text. Note: the `t` mock above does not interpolate {vars}, so buttons
 * whose label depends on a variable (e.g. the column-count stepper) must be
 * matched by their visible text instead.
 *
 * @param wrapper A mounted wrapper or a scoped element wrapper to search within
 * @param label The button's aria-label or visible text
 */
function findButton(wrapper, label) {
	return wrapper.findAllComponents(NcButton).find((button) => button.props('ariaLabel') === label || button.text() === label)
}

/**
 * Opens a column's "+" type-picker menu. NcActions teleports its menu content
 * into a popper that only mounts after a real timer tick (its floating-ui
 * positioning runs on a jsdom-polyfilled requestAnimationFrame) - a plain
 * nextTick/flushPromises does not surface it - see PageLayoutEditor.spec.js.
 *
 * @param wrapper A mounted wrapper containing the trigger
 */
async function openTypeMenu(wrapper) {
	await wrapper.get('[aria-label="Add content"]').trigger('click')
	await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Finds a component by a prop value. Sites and pages each have their own
 * "New" action, dialog, and name field, so components of the same type must
 * be disambiguated rather than matched by type alone.
 *
 * @param wrapper A mounted wrapper or a scoped element wrapper to search within
 * @param Component The component type to search for
 * @param prop The prop name to match on
 * @param value The prop value to match
 */
function findByProp(wrapper, Component, prop, value) {
	return wrapper.findAllComponents(Component).find((component) => component.props(prop) === value)
}

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchSites.mockResolvedValue([{ name: 'General' }])
		fetchPages.mockResolvedValue([])
	})

	it('loads and lists the pages on mount', async () => {
		fetchPages.mockResolvedValue([makePage({ path: 'a.md', title: 'a' }), makePage({ path: 'b.md', title: 'b' })])

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		expect(fetchPages).toHaveBeenCalledWith('General')
		const items = wrapper.get('.page-list').findAllComponents(NcAppNavigationItem)
		expect(items.map((item) => item.props('name'))).toEqual(['a', 'b'])
	})

	it('renders every Site in the switcher and auto-selects the first one', async () => {
		fetchSites.mockResolvedValue([{ name: 'Marketing' }, { name: 'General' }])

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		const items = wrapper.get('.site-switcher').findAllComponents(NcAppNavigationItem)
		expect(items.map((item) => item.props('name'))).toEqual(['Marketing', 'General'])
		expect(items[0].props('active')).toBe(true)
		expect(fetchPages).toHaveBeenCalledWith('Marketing')
	})

	it('switches to a different Site and loads its pages', async () => {
		fetchSites.mockResolvedValue([{ name: 'General' }, { name: 'Marketing' }])
		fetchPages.mockImplementation((site) => Promise.resolve(
			site === 'Marketing' ? [makePage({ path: 'Marketing/plan.md', title: 'plan' })] : [],
		))

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		const siteItems = wrapper.get('.site-switcher').findAllComponents(NcAppNavigationItem)
		await siteItems[1].vm.$emit('click')
		await flushPromises()

		expect(fetchPages).toHaveBeenCalledWith('Marketing')
		const pageItems = wrapper.get('.page-list').findAllComponents(NcAppNavigationItem)
		expect(pageItems.map((item) => item.props('name'))).toEqual(['plan'])
		expect(siteItems[1].props('active')).toBe(true)
	})

	it('creates a new Site and switches to it', async () => {
		fetchSites.mockResolvedValue([{ name: 'General' }])
		createSite.mockResolvedValue({ name: 'Marketing' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await findByProp(wrapper, NcAppNavigationNew, 'text', 'New Site').vm.$emit('click')
		await findByProp(wrapper, NcTextField, 'label', 'Site name').vm.$emit('update:modelValue', 'Marketing')
		await wrapper.vm.$nextTick()

		const createButton = findByProp(wrapper, NcDialog, 'name', 'New Site').props('buttons')[1]
		const result = await createButton.callback()
		await flushPromises()

		expect(createSite).toHaveBeenCalledWith('Marketing')
		expect(result).toBe(true)
		expect(fetchPages).toHaveBeenCalledWith('Marketing')
		const siteItems = wrapper.get('.site-switcher').findAllComponents(NcAppNavigationItem)
		expect(siteItems.map((item) => item.props('name'))).toEqual(['General', 'Marketing'])
	})

	it('shows an empty state explaining nothing has been shared yet when the user has zero Sites', async () => {
		// A Site member with nothing shared with them sees this - the same
		// screen a brand-new Site creator with no Sites yet also sees, so the
		// copy can't claim only one of those is true.
		fetchSites.mockResolvedValue([])

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		const empty = wrapper.findComponent(NcEmptyContent)
		expect(empty.props('name')).toBe('No Sites yet')
		expect(empty.props('description')).toContain('No Sites have been shared with you yet')
		expect(fetchPages).not.toHaveBeenCalled()
	})

	it('shows the page list of a single Site shared directly with the user', async () => {
		// Mechanically identical to a creator's multi-Site case - the
		// frontend has no notion of "member" vs "creator", it just renders
		// whatever fetchSites/fetchPages return - but this documents the
		// Site-member scenario from issue 03 explicitly.
		fetchSites.mockResolvedValue([{ name: 'Marketing' }])
		fetchPages.mockResolvedValue([makePage({ path: 'Marketing/plan.md', title: 'plan' })])

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		expect(fetchPages).toHaveBeenCalledWith('Marketing')
		const siteItems = wrapper.get('.site-switcher').findAllComponents(NcAppNavigationItem)
		expect(siteItems.map((item) => item.props('name'))).toEqual(['Marketing'])
		expect(siteItems[0].props('active')).toBe(true)
		const pageItems = wrapper.get('.page-list').findAllComponents(NcAppNavigationItem)
		expect(pageItems.map((item) => item.props('name'))).toEqual(['plan'])
	})

	it('shows an error when loading the page list fails', async () => {
		fetchPages.mockRejectedValue({ response: { status: 500 } })

		mount(App, mountOptions)
		await flushPromises()

		expect(showError).toHaveBeenCalledWith('Could not load the pages')
	})

	it('opens a page and renders its markdown content', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: '# Hello\n\nSome *text* and [a link](https://example.com).' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		expect(fetchPage).toHaveBeenCalledWith('welcome.md')
		const content = wrapper.get('.rich-content')
		expect(content.get('h1').text()).toBe('Hello')
		expect(content.get('em').text()).toBe('text')
		expect(content.get('a').attributes('href')).toBe('https://example.com')
	})

	it('does not render literal HTML from the markdown source as markup', async () => {
		// markdown-it is configured with html: false, and the result is sanitized with
		// dompurify on top - together they mean page authors cannot inject markup that
		// executes for other readers.
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: '# Hello <img src=x onerror=alert(1)>' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		const content = wrapper.get('.rich-content')
		expect(content.find('img').exists()).toBe(false)
		expect(content.get('h1').text()).toBe('Hello <img src=x onerror=alert(1)>')
	})

	it('shows a permission-specific error when opening a page is forbidden', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockRejectedValue({ response: { status: 403 } })

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		expect(showError).toHaveBeenCalledWith('You do not have permission to do this')
	})

	it('lets a writable page be edited and saved', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })
		savePage.mockResolvedValue(makePage({ mtime: 2000 }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		// Editing a legacy markdown page upgrades it to a single richtext webpart,
		// pre-filled with the rendered markdown.
		const webpart = wrapper.get('.richtext-stub')
		expect(webpart.element.value).toBe(renderMarkdown('original'))

		await webpart.setValue('updated')
		const saveButton = wrapper.get('.page__header').findAllComponents(NcButton).at(1)
		await saveButton.vm.$emit('click', clickEvent)
		await flushPromises()

		expect(savePage).toHaveBeenCalledOnce()
		const [path, content] = savePage.mock.calls[0]
		expect(path).toBe('welcome.md')
		expect(JSON.parse(content).rows[0].columns[0].webparts[0].data).toEqual({ html: 'updated' })
		expect(wrapper.find('.richtext-stub').exists()).toBe(false)
	})

	it('opens the row settings panel and changes the column count', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })
		savePage.mockResolvedValue(makePage({ mtime: 2000 }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('.page-layout-editor__column')).toHaveLength(1)

		await findButton(wrapper, 'Row settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await findButton(wrapper, '3').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('.page-layout-editor__column')).toHaveLength(3)

		const saveButton = wrapper.get('.page__header').findAllComponents(NcButton).at(1)
		await saveButton.vm.$emit('click', clickEvent)
		await flushPromises()

		const [, content] = savePage.mock.calls[0]
		expect(JSON.parse(content).rows[0].columns).toHaveLength(3)
	})

	it('sets a two-column row\'s width ratio from the row settings panel', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })
		savePage.mockResolvedValue(makePage({ mtime: 2000 }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Row settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await findButton(wrapper, '2').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await findButton(wrapper, '33 / 67').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		const saveButton = wrapper.get('.page__header').findAllComponents(NcButton).at(1)
		await saveButton.vm.$emit('click', clickEvent)
		await flushPromises()

		const [, content] = savePage.mock.calls[0]
		expect(JSON.parse(content).rows[0].widths).toEqual([1, 2])
	})

	it('moves and removes a row from the row settings panel', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })
		savePage.mockResolvedValue(makePage({ mtime: 2000 }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Add row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		expect(wrapper.findAll('.page-layout-editor__row')).toHaveLength(2)

		// Open settings for the first row: move-down should be enabled, move-up disabled.
		await findButton(wrapper, 'Row settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		expect(findButton(wrapper, 'Move row up').props('disabled')).toBe(true)
		expect(findButton(wrapper, 'Move row down').props('disabled')).toBe(false)

		await findButton(wrapper, 'Remove row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('.page-layout-editor__row')).toHaveLength(1)
		// Removing the active row closes the panel.
		expect(findButton(wrapper, 'Remove row')).toBeUndefined()
	})

	it('selects a webpart, showing its type label and a Remove action in the Webpart tab', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(findButton(wrapper, 'Row')).toBeTruthy()
		expect(findButton(wrapper, 'Webpart')).toBeTruthy()
		expect(wrapper.get('.row-settings__section').text()).toContain('Text')

		await findButton(wrapper, 'Remove').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		// Removing the active Webpart clears its selection - back to Row-only.
		expect(findButton(wrapper, 'Webpart')).toBeUndefined()
		expect(wrapper.findAll('.page-layout-editor__webpart')).toHaveLength(0)
	})

	it('keeps both selections when switching between the Row and Webpart tabs', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.get('.row-settings__section').text()).toContain('Columns')
		// Switching tabs did not clear the Webpart selection.
		expect(wrapper.get('.page-layout-editor__webpart').classes()).toContain('page-layout-editor__webpart--active')
		expect(findButton(wrapper, 'Webpart')).toBeTruthy()

		await findButton(wrapper, 'Webpart').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.get('.row-settings__section').text()).toContain('Text')
	})

	it('replaces the webpart selection when a different row is selected', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Add row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		expect(findButton(wrapper, 'Webpart')).toBeTruthy()

		const rowTriggers = wrapper.findAllComponents(NcButton).filter((button) => button.props('ariaLabel') === 'Row settings')
		await rowTriggers[1].vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(findButton(wrapper, 'Webpart')).toBeUndefined()
	})

	it('closes the sidebar when the row holding the active webpart is removed from the Row tab', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		// Switch to the Row tab without deselecting the Webpart, then remove the row from there -
		// activeWebpartId must be cleared alongside activeRowId, not just left dangling.
		await findButton(wrapper, 'Row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Remove row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(findButton(wrapper, 'Remove row')).toBeUndefined()
		expect(findButton(wrapper, 'Webpart')).toBeUndefined()
	})

	it('re-opens the Webpart tab when its already-active trigger is clicked again from the Row tab', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await findButton(wrapper, 'Row').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		expect(wrapper.get('.row-settings__section').text()).toContain('Columns')

		// Same Webpart, already active - a plain ref-change watch would miss this.
		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.get('.row-settings__section').text()).toContain('Text')
	})

	it('resets the webpart selection when edit mode is left and resumed', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		expect(findButton(wrapper, 'Webpart')).toBeTruthy()

		await findButton(wrapper, 'Cancel').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('.page-layout-editor__webpart--active')).toHaveLength(0)
		expect(findButton(wrapper, 'Webpart')).toBeUndefined()
	})

	it('shows no settings fields in the Webpart pane for a richtext webpart', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		expect(wrapper.findComponent(NcAppSidebar).findAllComponents(NcTextField)).toHaveLength(0)
	})

	it('edits a newsgrid webpart\'s "All news link" from its settings field in the Webpart pane', async () => {
		const layout = {
			version: 1,
			rows: [
				{
					id: 'row-1',
					columns: [
						{ id: 'col-1', webparts: [{ id: 'wp-1', type: 'newsgrid', data: { items: [], allNewsLink: '' } }] },
					],
				},
			],
		}
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: JSON.stringify(layout) })
		savePage.mockResolvedValue(makePage({ mtime: 2000 }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findButton(wrapper, 'Webpart settings').vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await findByProp(wrapper, NcTextField, 'label', 'All news link').vm.$emit('update:modelValue', 'https://example.com/news')
		await wrapper.vm.$nextTick()

		const saveButton = wrapper.get('.page__header').findAllComponents(NcButton).at(1)
		await saveButton.vm.$emit('click', clickEvent)
		await flushPromises()

		const [, content] = savePage.mock.calls[0]
		expect(JSON.parse(content).rows[0].columns[0].webparts[0].data.allNewsLink).toBe('https://example.com/news')
	})

	it('opens the Webpart pane on the new Webpart as soon as a type is picked from the "+" menu', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: 'original' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()
		await wrapper.get('.page__header').findComponent(NcButton).vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		await openTypeMenu(wrapper)
		const newsGridEntry = wrapper.findAllComponents(NcActionButton).find((button) => button.text() === 'News grid')
		await newsGridEntry.vm.$emit('click', clickEvent)
		await wrapper.vm.$nextTick()

		// The pane opened straight to the "Webpart" tab, with the newly created
		// News grid webpart both selected and highlighted, no hover needed.
		expect(wrapper.get('.row-settings__section').text()).toContain('News grid')
		const activeWebparts = wrapper.findAll('.page-layout-editor__webpart--active')
		expect(activeWebparts).toHaveLength(1)
		expect(activeWebparts[0].find('.newsgrid-webpart').exists()).toBe(true)
	})

	it('does not offer an edit button for a read-only page', async () => {
		fetchPages.mockResolvedValue([makePage({ writable: false })])
		fetchPage.mockResolvedValue({ ...makePage({ writable: false }), content: 'read only' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		expect(wrapper.get('.page__header').findComponent(NcButton).exists()).toBe(false)
	})

	it('disables page creation until a title is entered', async () => {
		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await findByProp(wrapper, NcAppNavigationNew, 'text', 'New page').vm.$emit('click')
		await wrapper.vm.$nextTick()

		let dialog = findByProp(wrapper, NcDialog, 'name', 'New page')
		expect(dialog.props('buttons')[1].disabled).toBe(true)

		await findByProp(wrapper, NcTextField, 'label', 'Page name').vm.$emit('update:modelValue', 'Handbook')
		await wrapper.vm.$nextTick()

		dialog = findByProp(wrapper, NcDialog, 'name', 'New page')
		expect(dialog.props('buttons')[1].disabled).toBe(false)
	})

	it('creates a new page and opens it in edit mode', async () => {
		fetchPages.mockResolvedValue([])
		savePage.mockResolvedValue(makePage({ path: 'handbook.md', title: 'Handbook' }))

		const wrapper = mount(App, mountOptions)
		await flushPromises()

		await findByProp(wrapper, NcAppNavigationNew, 'text', 'New page').vm.$emit('click')
		await findByProp(wrapper, NcTextField, 'label', 'Page name').vm.$emit('update:modelValue', 'Handbook')
		await wrapper.vm.$nextTick()

		const createButton = findByProp(wrapper, NcDialog, 'name', 'New page').props('buttons')[1]
		const result = await createButton.callback()

		expect(savePage).toHaveBeenCalledWith('General/Handbook.md', '')
		expect(result).toBe(true)
		expect(wrapper.get('.richtext-stub').element.value).toBe('')
	})

	it('renders a page stored as a layout, sanitizing each webpart', async () => {
		const layout = {
			version: 1,
			rows: [
				{
					id: 'row-1',
					columns: [
						{
							id: 'col-1',
							webparts: [
								{ id: 'wp-1', type: 'richtext', html: '<p>Hello <img src=x onerror=alert(1)></p>' },
							],
						},
					],
				},
			],
		}
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: JSON.stringify(layout) })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		const content = wrapper.get('.rich-content')
		expect(content.text()).toContain('Hello')
		// DOMPurify's default config keeps <img> (a legitimate tag) but strips
		// event handler attributes like onerror - that's the actual guarantee.
		expect(content.html()).not.toContain('onerror')
	})

	it('falls back to legacy markdown rendering for JSON with the wrong shape', async () => {
		fetchPages.mockResolvedValue([makePage()])
		fetchPage.mockResolvedValue({ ...makePage(), content: '{"rows":"nope"}' })

		const wrapper = mount(App, mountOptions)
		await flushPromises()
		await wrapper.get('.page-list').findComponent(NcAppNavigationItem).vm.$emit('click')
		await flushPromises()

		expect(wrapper.get('.rich-content').text()).toContain('{"rows":"nope"}')
	})
})
