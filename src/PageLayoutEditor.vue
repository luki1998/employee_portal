<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { mdiCog, mdiPlus } from '@mdi/js'
import { t } from '@nextcloud/l10n'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { addRow, addWebpart, getGridTemplateColumns, setWebpartData } from './layout.js'
import { webpartTypes } from './webparts/registry.js'
import WebpartInstance from './webparts/WebpartInstance.vue'

const props = defineProps({
	modelValue: {
		type: Object,
		required: true,
	},
	activeRowId: {
		type: String,
		default: null,
	},
	activeWebpartId: {
		type: String,
		default: null,
	},
})

const emit = defineEmits(['update:modelValue', 'update:activeRowId', 'update:activeWebpartId'])

function handleAddRow() {
	addRow(props.modelValue)
	emit('update:modelValue', props.modelValue)
}

/**
 * @param {import('./layout.js').Row} row
 */
function handleSelectRow(row) {
	emit('update:activeRowId', row.id)
	emit('update:activeWebpartId', null)
}

/**
 * @param {import('./layout.js').Row} row
 * @param {import('./layout.js').Webpart} webpart
 */
function handleSelectWebpart(row, webpart) {
	emit('update:activeRowId', row.id)
	emit('update:activeWebpartId', webpart.id)
}

/**
 * Adds a Webpart and immediately selects it, so its pane opens on creation -
 * see handleSelectWebpart.
 *
 * @param {import('./layout.js').Row} row
 * @param {import('./layout.js').Column} column
 * @param {string} type
 */
function handleAddWebpart(row, column, type) {
	const webpart = addWebpart(props.modelValue, row.id, column.id, type)
	emit('update:modelValue', props.modelValue)

	if (webpart) {
		handleSelectWebpart(row, webpart)
	}
}

/**
 * @param {import('./layout.js').Webpart} webpart
 * @param {object} data
 */
function handleUpdateWebpartData(webpart, data) {
	setWebpartData(webpart, data)
	emit('update:modelValue', props.modelValue)
}
</script>

<template>
	<div class="page-layout-editor">
		<div
			v-for="row in modelValue.rows"
			:key="row.id"
			class="page-layout-editor__row"
			:class="{ 'page-layout-editor__row--active': row.id === activeRowId }">
			<NcButton
				variant="tertiary"
				size="small"
				class="page-layout-editor__select-trigger page-layout-editor__row-trigger"
				:aria-label="t('employee_portal', 'Row settings')"
				@click="handleSelectRow(row)">
				<template #icon>
					<NcIconSvgWrapper :path="mdiCog" :size="20" />
				</template>
			</NcButton>

			<div class="page-layout-editor__grid" :style="{ 'grid-template-columns': getGridTemplateColumns(row) }">
				<div v-for="column in row.columns" :key="column.id" class="page-layout-editor__column">
					<div
						v-for="webpart in column.webparts"
						:key="webpart.id"
						class="page-layout-editor__webpart"
						:class="{ 'page-layout-editor__webpart--active': webpart.id === activeWebpartId }">
						<WebpartInstance
							:webpart="webpart"
							mode="edit"
							@update:data="handleUpdateWebpartData(webpart, $event)" />
						<NcButton
							variant="tertiary"
							size="small"
							class="page-layout-editor__select-trigger page-layout-editor__webpart-trigger"
							:aria-label="t('employee_portal', 'Webpart settings')"
							@click="handleSelectWebpart(row, webpart)">
							<template #icon>
								<NcIconSvgWrapper :path="mdiCog" :size="20" />
							</template>
						</NcButton>
					</div>

					<NcActions
						force-menu
						:aria-label="t('employee_portal', 'Add content')">
						<template #icon>
							<NcIconSvgWrapper :path="mdiPlus" :size="20" />
						</template>
						<NcActionButton
							v-for="(type, key) in webpartTypes"
							:key="key"
							@click="handleAddWebpart(row, column, key)">
							<template #icon>
								<NcIconSvgWrapper :path="type.icon" :size="20" />
							</template>
							{{ type.label }}
						</NcActionButton>
					</NcActions>
				</div>
			</div>
		</div>

		<NcButton variant="secondary" @click="handleAddRow()">
			<template #icon>
				<NcIconSvgWrapper :path="mdiPlus" :size="20" />
			</template>
			{{ t('employee_portal', 'Add row') }}
		</NcButton>
	</div>
</template>

<style scoped>
.page-layout-editor__row {
	position: relative;
	margin-block-end: calc(var(--default-grid-baseline) * 4);
	padding: calc(var(--default-grid-baseline) * 2);
	border: 1px dashed var(--color-border);
	border-radius: var(--border-radius-large);
}

.page-layout-editor__row--active {
	border-color: var(--color-primary-element);
}

.page-layout-editor__select-trigger {
	opacity: 0;
	transition: opacity 0.1s ease-in-out;
}

.page-layout-editor__row-trigger {
	position: absolute;
	inset-block-start: var(--default-grid-baseline);
	inset-inline-end: var(--default-grid-baseline);
}

.page-layout-editor__row:hover .page-layout-editor__row-trigger,
.page-layout-editor__row:focus-within .page-layout-editor__row-trigger,
.page-layout-editor__row--active .page-layout-editor__row-trigger {
	opacity: 1;
}

.page-layout-editor__webpart:hover .page-layout-editor__webpart-trigger,
.page-layout-editor__webpart:focus-within .page-layout-editor__webpart-trigger,
.page-layout-editor__webpart--active .page-layout-editor__webpart-trigger {
	opacity: 1;
}

.page-layout-editor__grid {
	display: grid;
	gap: calc(var(--default-grid-baseline) * 4);
}

.page-layout-editor__column {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.page-layout-editor__webpart {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	padding: calc(var(--default-grid-baseline) * 2);
	border: 1px solid transparent;
	border-radius: var(--border-radius-large);
}

.page-layout-editor__webpart--active {
	border-color: var(--color-primary-element);
}

.page-layout-editor__webpart-trigger {
	position: absolute;
	inset-block-start: var(--default-grid-baseline);
	inset-inline-end: var(--default-grid-baseline);
}
</style>
