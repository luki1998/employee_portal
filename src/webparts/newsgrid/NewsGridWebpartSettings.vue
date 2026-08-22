<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { t } from '@nextcloud/l10n'
import NcTextField from '@nextcloud/vue/components/NcTextField'

const props = defineProps({
	data: {
		type: Object,
		default: () => ({ items: [], allNewsLink: '' }),
	},
})

const emit = defineEmits(['update:data'])

/**
 * @param {string} allNewsLink
 */
function onAllNewsLinkChange(allNewsLink) {
	emit('update:data', { ...props.data, allNewsLink })
}
</script>

<template>
	<div class="newsgrid-webpart-settings">
		<NcTextField
			:model-value="data.allNewsLink ?? ''"
			:label="t('employee_portal', 'All news link')"
			:helperText="t('employee_portal', 'Where readers can find a fuller news listing. Leave empty to hide the link.')"
			@update:model-value="onAllNewsLinkChange" />
	</div>
</template>
