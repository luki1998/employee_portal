<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { t } from '@nextcloud/l10n'
import { getGridTemplateColumns } from './layout.js'
import { webpartTypes } from './webparts/registry.js'

defineProps({
	layout: {
		type: Object,
		required: true,
	},
})
</script>

<template>
	<div class="page-layout">
		<div
			v-for="row in layout.rows"
			:key="row.id"
			class="page-layout__row"
			:style="{ 'grid-template-columns': getGridTemplateColumns(row) }">
			<div v-for="column in row.columns" :key="column.id" class="page-layout__column">
				<template v-for="webpart in column.webparts" :key="webpart.id">
					<component :is="webpartTypes[webpart.type]?.view" v-if="webpartTypes[webpart.type]" v-bind="webpart" />
					<p v-else class="page-layout__unsupported">
						{{ t('employee_portal', 'This content type is not supported.') }}
					</p>
				</template>
			</div>
		</div>
	</div>
</template>

<style scoped>
.page-layout__row {
	display: grid;
	gap: calc(var(--default-grid-baseline) * 4);
	margin-block-end: calc(var(--default-grid-baseline) * 4);
}

.page-layout__unsupported {
	color: var(--color-text-maxcontrast);
	font-style: italic;
}
</style>
