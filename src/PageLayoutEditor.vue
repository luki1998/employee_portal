<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { mdiCog, mdiDelete, mdiPlus, mdiTextBoxPlusOutline } from '@mdi/js'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { addRow, addWebpart, getGridTemplateColumns, removeWebpart, setWebpartData } from './layout.js'
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
})

const emit = defineEmits(['update:modelValue', 'update:activeRowId'])

function handleAddRow() {
	addRow(props.modelValue)
	emit('update:modelValue', props.modelValue)
}

/**
 * @param {import('./layout.js').Row} row
 * @param {import('./layout.js').Column} column
 */
function handleAddWebpart(row, column) {
	addWebpart(props.modelValue, row.id, column.id)
	emit('update:modelValue', props.modelValue)
}

/**
 * @param {import('./layout.js').Row} row
 * @param {import('./layout.js').Column} column
 * @param {import('./layout.js').Webpart} webpart
 */
function handleRemoveWebpart(row, column, webpart) {
	removeWebpart(props.modelValue, row.id, column.id, webpart.id)
	emit('update:modelValue', props.modelValue)
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
				class="page-layout-editor__row-gear"
				:aria-label="t('employee_portal', 'Row settings')"
				@click="emit('update:activeRowId', row.id)">
				<template #icon>
					<NcIconSvgWrapper :path="mdiCog" :size="20" />
				</template>
			</NcButton>

			<div class="page-layout-editor__grid" :style="{ 'grid-template-columns': getGridTemplateColumns(row) }">
				<div v-for="column in row.columns" :key="column.id" class="page-layout-editor__column">
					<div v-for="webpart in column.webparts" :key="webpart.id" class="page-layout-editor__webpart">
						<WebpartInstance
							:webpart="webpart"
							mode="edit"
							@update:data="handleUpdateWebpartData(webpart, $event)" />
						<NcButton
							variant="tertiary"
							:aria-label="t('employee_portal', 'Remove text')"
							@click="handleRemoveWebpart(row, column, webpart)">
							<template #icon>
								<NcIconSvgWrapper :path="mdiDelete" :size="20" />
							</template>
							{{ t('employee_portal', 'Remove') }}
						</NcButton>
					</div>

					<NcButton variant="tertiary" @click="handleAddWebpart(row, column)">
						<template #icon>
							<NcIconSvgWrapper :path="mdiTextBoxPlusOutline" :size="20" />
						</template>
						{{ t('employee_portal', 'Add text') }}
					</NcButton>
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

.page-layout-editor__row-gear {
	position: absolute;
	inset-block-start: var(--default-grid-baseline);
	inset-inline-end: var(--default-grid-baseline);
	opacity: 0;
	transition: opacity 0.1s ease-in-out;
}

.page-layout-editor__row:hover .page-layout-editor__row-gear,
.page-layout-editor__row:focus-within .page-layout-editor__row-gear,
.page-layout-editor__row--active .page-layout-editor__row-gear {
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
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}
</style>
