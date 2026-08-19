<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { mdiArrowDown, mdiArrowUp, mdiDelete, mdiFileDocumentOutline, mdiFolderOutline, mdiPencilOutline, mdiPlus } from '@mdi/js'
import { showError } from '@nextcloud/dialogs'
import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcAppNavigationList from '@nextcloud/vue/components/NcAppNavigationList'
import NcAppNavigationNew from '@nextcloud/vue/components/NcAppNavigationNew'
import NcAppSidebar from '@nextcloud/vue/components/NcAppSidebar'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { convertMarkdownToLayout, MAX_COLUMNS, moveRow, parseLayout, removeRow, serializeLayout, setColumnCount, setColumnWidths } from './layout.js'
import { renderMarkdown } from './markdown.js'
import PageLayoutEditor from './PageLayoutEditor.vue'
import PageLayoutViewer from './PageLayoutViewer.vue'
import { fetchPage, fetchPages, savePage } from './services/pages.js'
import { createSite, fetchSites } from './services/sites.js'

const sites = ref([])
const currentSite = ref(null)
const pages = ref([])
const current = ref(null)
const draftLayout = ref(null)
const editing = ref(false)
const activeRowId = ref(null)
const loading = ref(true)
const saving = ref(false)
const creating = ref(false)
const newPageOpen = ref(false)
const newPageTitle = ref('')
const creatingSite = ref(false)
const newSiteOpen = ref(false)
const newSiteName = ref('')

// The row currently targeted by the sidebar, if any.
const activeRow = computed(() => draftLayout.value?.rows.find((row) => row.id === activeRowId.value) ?? null)
const activeRowIndex = computed(() => draftLayout.value?.rows.findIndex((row) => row.id === activeRowId.value) ?? -1)

// A page's content is either a JSON layout (rows of columns of webparts) or,
// for pages not yet touched by the layout editor, plain legacy markdown.
const parsed = computed(() => parseLayout(current.value?.content ?? ''))

const newPageButtons = computed(() => [
	{
		label: t('employee_portal', 'Cancel'),
		disabled: creating.value,
	},
	{
		label: t('employee_portal', 'Create'),
		variant: 'primary',
		disabled: creating.value || newPageTitle.value.trim() === '',
		callback: createPage,
	},
])

const newSiteButtons = computed(() => [
	{
		label: t('employee_portal', 'Cancel'),
		disabled: creatingSite.value,
	},
	{
		label: t('employee_portal', 'Create'),
		variant: 'primary',
		disabled: creatingSite.value || newSiteName.value.trim() === '',
		callback: addSite,
	},
])

onMounted(loadSites)

/**
 * Load the list of Sites, and select the first one if any exist - a
 * single-Site install then looks unchanged, with its pages shown right away.
 */
async function loadSites() {
	loading.value = true
	try {
		sites.value = await fetchSites()
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not load the sites')))
		loading.value = false

		return
	}

	if (sites.value.length > 0) {
		await selectSite(sites.value[0].name)
	} else {
		loading.value = false
	}
}

/**
 * Switch to a Site and load its pages.
 *
 * @param {string} name Name of the Site to switch to
 */
async function selectSite(name) {
	currentSite.value = name
	current.value = null
	editing.value = false
	activeRowId.value = null
	await loadPages()
}

/**
 * Load the page list of the current Site.
 */
async function loadPages() {
	loading.value = true
	try {
		pages.value = await fetchPages(currentSite.value)
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not load the pages')))
	} finally {
		loading.value = false
	}
}

/**
 * Open a page in read mode.
 *
 * @param {string} path Path of the page, relative to the portal folder
 */
async function openPage(path) {
	try {
		current.value = await fetchPage(path)
		editing.value = false
		activeRowId.value = null
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not open the page')))
	}
}

/**
 * Builds an editable layout draft from the current page: its own layout if it
 * already has one, or a legacy markdown page upgraded into a single richtext
 * webpart otherwise. Nothing is persisted until the draft is saved.
 */
function buildDraftLayout() {
	draftLayout.value = parsed.value.kind === 'layout'
		? JSON.parse(JSON.stringify(parsed.value.layout))
		: convertMarkdownToLayout(parsed.value.markdown, renderMarkdown)
}

/**
 * Switch the current page to edit mode.
 */
function startEditing() {
	buildDraftLayout()
	activeRowId.value = null
	editing.value = true
}

/**
 * Leave edit mode without saving.
 */
function cancelEditing() {
	editing.value = false
	activeRowId.value = null
}

/**
 * Write the draft back to the current page.
 */
async function save() {
	saving.value = true
	try {
		const content = serializeLayout(draftLayout.value)
		const page = await savePage(current.value.path, content)
		current.value = { ...page, content }
		editing.value = false
		activeRowId.value = null
		upsertPage(page)
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not save the page')))
	} finally {
		saving.value = false
	}
}

/**
 * @param {number} count
 */
function changeActiveRowColumnCount(count) {
	if (activeRow.value) {
		setColumnCount(draftLayout.value, activeRow.value.id, count)
	}
}

/**
 * @param {[number, number]} widths
 */
function changeActiveRowColumnWidths(widths) {
	if (activeRow.value) {
		setColumnWidths(draftLayout.value, activeRow.value.id, widths)
	}
}

/**
 * @param {[number, number]} widths
 * @return {boolean}
 */
function isActiveRowWidths(widths) {
	return JSON.stringify(activeRow.value?.widths) === JSON.stringify(widths)
}

/**
 * @param {-1 | 1} direction
 */
function handleMoveActiveRow(direction) {
	if (activeRow.value) {
		moveRow(draftLayout.value, activeRow.value.id, direction)
	}
}

function handleRemoveActiveRow() {
	if (activeRow.value) {
		removeRow(draftLayout.value, activeRow.value.id)
		activeRowId.value = null
	}
}

/**
 * Create an empty page and open it in edit mode.
 *
 * @return {Promise<boolean>} False to keep the dialog open when creation failed
 */
async function createPage() {
	creating.value = true
	try {
		const page = await savePage(`${currentSite.value}/${newPageTitle.value.trim()}.md`, '')
		upsertPage(page)
		current.value = { ...page, content: '' }
		buildDraftLayout()
		editing.value = true
		newPageOpen.value = false
		newPageTitle.value = ''

		return true
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not create the page')))

		return false
	} finally {
		creating.value = false
	}
}

/**
 * Create a new Site and switch to it.
 *
 * @return {Promise<boolean>} False to keep the dialog open when creation failed
 */
async function addSite() {
	creatingSite.value = true
	try {
		const site = await createSite(newSiteName.value.trim())
		sites.value = [...sites.value, site].sort((a, b) => a.name.localeCompare(b.name))
		newSiteOpen.value = false
		newSiteName.value = ''
		await selectSite(site.name)

		return true
	} catch (error) {
		showError(errorMessage(error, t('employee_portal', 'Could not create the site')))

		return false
	} finally {
		creatingSite.value = false
	}
}

/**
 * Add a page to the list, or refresh it if it is already listed.
 *
 * @param {object} page The page as returned by the API
 */
function upsertPage(page) {
	const index = pages.value.findIndex(({ path }) => path === page.path)
	if (index === -1) {
		pages.value.push(page)
		pages.value.sort((a, b) => a.title.localeCompare(b.title))
	} else {
		pages.value.splice(index, 1, page)
	}
}

/**
 * Turn a failed request into a message. The permission cases come straight from
 * the Files API, which is what decides them.
 *
 * @param {object} error The rejected axios error
 * @param {string} fallback Message for anything that is not a known status
 * @return {string}
 */
function errorMessage(error, fallback) {
	switch (error.response?.status) {
	case 400:
		return t('employee_portal', 'Page names must not contain a slash')
	case 403:
		return t('employee_portal', 'You do not have permission to do this')
	case 404:
		return t('employee_portal', 'This page does not exist')
	default:
		return fallback
	}
}
</script>

<template>
	<NcContent appName="employee_portal">
		<NcAppNavigation :aria-label="t('employee_portal', 'Sites and pages')">
			<template #default>
				<NcAppNavigationNew
					:text="t('employee_portal', 'New Site')"
					@click="newSiteOpen = true">
					<template #icon>
						<NcIconSvgWrapper :path="mdiPlus" :size="20" />
					</template>
				</NcAppNavigationNew>
				<NcAppNavigationNew
					v-if="currentSite"
					:text="t('employee_portal', 'New page')"
					@click="newPageOpen = true">
					<template #icon>
						<NcIconSvgWrapper :path="mdiPlus" :size="20" />
					</template>
				</NcAppNavigationNew>
			</template>

			<template #list>
				<NcAppNavigationList class="site-switcher">
					<NcAppNavigationItem
						v-for="site in sites"
						:key="site.name"
						:name="site.name"
						:active="site.name === currentSite"
						@click="selectSite(site.name)">
						<template #icon>
							<NcIconSvgWrapper :path="mdiFolderOutline" :size="20" />
						</template>
					</NcAppNavigationItem>
				</NcAppNavigationList>

				<NcAppNavigationList v-if="currentSite" class="page-list">
					<NcAppNavigationItem
						v-for="page in pages"
						:key="page.path"
						:name="page.title"
						:active="page.path === current?.path"
						@click="openPage(page.path)">
						<template #icon>
							<NcIconSvgWrapper :path="mdiFileDocumentOutline" :size="20" />
						</template>
					</NcAppNavigationItem>
				</NcAppNavigationList>
			</template>
		</NcAppNavigation>

		<NcAppContent>
			<NcLoadingIcon v-if="loading" class="portal__loading" :size="44" />

			<NcEmptyContent
				v-else-if="sites.length === 0"
				:name="t('employee_portal', 'No Sites yet')"
				:description="t('employee_portal', 'No Sites have been shared with you yet. If you have access to create one, use \'New Site\' above.')">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFolderOutline" />
				</template>
			</NcEmptyContent>

			<NcEmptyContent
				v-else-if="current === null"
				:name="t('employee_portal', 'No page selected')"
				:description="t('employee_portal', 'Pick a page from the list, or create a new one.')">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFileDocumentOutline" />
				</template>
			</NcEmptyContent>

			<article v-else class="page">
				<header class="page__header">
					<h2 class="page__title">
						{{ current.title}}
					</h2>

					<NcButton
						v-if="!editing && current.writable"
						@click="startEditing()">
						<template #icon>
							<NcIconSvgWrapper :path="mdiPencilOutline" :size="20" />
						</template>
						{{ t('employee_portal', 'Editieren') }}
					</NcButton>

					<template v-if="editing">
						<NcButton :disabled="saving" @click="cancelEditing()">
							{{ t('employee_portal', 'Cancel') }}
						</NcButton>
						<NcButton variant="primary" :disabled="saving" @click="save()">
							{{ t('employee_portal', 'Save') }}
						</NcButton>
					</template>
				</header>

				<PageLayoutEditor v-if="editing" v-model="draftLayout" v-model:active-row-id="activeRowId" />
				<PageLayoutViewer v-else-if="parsed.kind === 'layout'" :layout="parsed.layout" />
				<!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown sanitizes its output -->
				<div v-else class="rich-content" v-html="renderMarkdown(parsed.markdown)" />
			</article>
		</NcAppContent>

		<NcAppSidebar
			v-if="editing"
			:open="activeRow !== null"
			no-toggle
			:name="t('employee_portal', 'Row settings')"
			@close="activeRowId = null">
			<template v-if="activeRow">
				<section class="row-settings__section">
					<h3>{{ t('employee_portal', 'Columns') }}</h3>
					<div class="row-settings__stepper">
						<NcButton
							v-for="count in MAX_COLUMNS"
							:key="count"
							variant="tertiary"
							:pressed="activeRow.columns.length === count"
							:aria-label="t('employee_portal', 'Use {count} column(s)', { count })"
							@click="changeActiveRowColumnCount(count)">
							{{ count }}
						</NcButton>
					</div>
				</section>

				<section v-if="activeRow.columns.length === 2" class="row-settings__section">
					<h3>{{ t('employee_portal', 'Column width') }}</h3>
					<div class="row-settings__stepper">
						<NcButton
							variant="tertiary"
							:pressed="isActiveRowWidths([1, 1])"
							:aria-label="t('employee_portal', 'Equal width columns')"
							@click="changeActiveRowColumnWidths([1, 1])">
							50 / 50
						</NcButton>
						<NcButton
							variant="tertiary"
							:pressed="isActiveRowWidths([1, 2])"
							:aria-label="t('employee_portal', 'Narrow first column')"
							@click="changeActiveRowColumnWidths([1, 2])">
							33 / 67
						</NcButton>
						<NcButton
							variant="tertiary"
							:pressed="isActiveRowWidths([2, 1])"
							:aria-label="t('employee_portal', 'Narrow second column')"
							@click="changeActiveRowColumnWidths([2, 1])">
							67 / 33
						</NcButton>
					</div>
				</section>

				<section class="row-settings__section">
					<NcButton
						variant="tertiary"
						:disabled="activeRowIndex <= 0"
						@click="handleMoveActiveRow(-1)">
						<template #icon>
							<NcIconSvgWrapper :path="mdiArrowUp" :size="20" />
						</template>
						{{ t('employee_portal', 'Move row up') }}
					</NcButton>
					<NcButton
						variant="tertiary"
						:disabled="activeRowIndex === -1 || activeRowIndex === draftLayout.rows.length - 1"
						@click="handleMoveActiveRow(1)">
						<template #icon>
							<NcIconSvgWrapper :path="mdiArrowDown" :size="20" />
						</template>
						{{ t('employee_portal', 'Move row down') }}
					</NcButton>
					<NcButton
						variant="tertiary"
						@click="handleRemoveActiveRow()">
						<template #icon>
							<NcIconSvgWrapper :path="mdiDelete" :size="20" />
						</template>
						{{ t('employee_portal', 'Remove row') }}
					</NcButton>
				</section>
			</template>
		</NcAppSidebar>

		<NcDialog
			v-model:open="newSiteOpen"
			:name="t('employee_portal', 'New Site')"
			:buttons="newSiteButtons"
			size="small">
			<NcTextField
				v-model="newSiteName"
				:label="t('employee_portal', 'Site name')"
				:helperText="t('employee_portal', 'The Site is stored as a folder in the EmployeePortal folder.')" />
		</NcDialog>

		<NcDialog
			v-model:open="newPageOpen"
			:name="t('employee_portal', 'New page')"
			:buttons="newPageButtons"
			size="small">
			<NcTextField
				v-model="newPageTitle"
				:label="t('employee_portal', 'Page name')"
				:helperText="t('employee_portal', 'The page is stored as a markdown file in the current Site.')" />
		</NcDialog>
	</NcContent>
</template>

<style scoped lang="scss">
.portal__loading {
	margin-block-start: 20vh;
}

.page {
	max-width: 800px;
	margin-inline: auto;
	padding: calc(var(--default-grid-baseline) * 4);
	// Offset the floating navigation toggle button pinned to the top-left.
	padding-block-start: var(--default-clickable-area);
}

.page__header {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	margin-block-end: calc(var(--default-grid-baseline) * 4);
}

.page__title {
	flex: 1 1 auto;
	margin: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.row-settings__section {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--default-grid-baseline);
	padding: calc(var(--default-grid-baseline) * 2);
	border-block-end: 1px solid var(--color-border);
}

.row-settings__stepper {
	display: flex;
	gap: 2px;
}
</style>
