<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { getGridTemplateColumns } from './layout.js'
import WebpartInstance from './webparts/WebpartInstance.vue'

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
				<WebpartInstance
					v-for="webpart in column.webparts"
					:key="webpart.id"
					:webpart="webpart"
					mode="view" />
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

</style>
