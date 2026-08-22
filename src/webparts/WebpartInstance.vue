<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { onErrorCaptured, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import { getWebpartData } from '../layout.js'
import { webpartTypes } from './registry.js'

const props = defineProps({
	webpart: {
		type: Object,
		required: true,
	},
	mode: {
		type: String,
		required: true,
		validator: (value) => ['view', 'edit'].includes(value),
	},
})

const emit = defineEmits(['update:data'])

const crashed = ref(false)

// Guards descendants only - never the component throwing the hook itself -
// so it's registered here, one level above the type's own edit/view
// component, rather than inside it.
onErrorCaptured(() => {
	crashed.value = true

	// Stop propagation: one Webpart instance failing must not blank the page.
	return false
})
</script>

<template>
	<div class="webpart-instance">
		<p v-if="!webpartTypes[webpart.type]" class="webpart-instance__placeholder webpart-instance__placeholder--unregistered">
			{{ t('employee_portal', 'This content type ("{type}") is not available. Its data is kept.', { type: webpart.type }) }}
		</p>
		<p v-else-if="crashed" class="webpart-instance__placeholder webpart-instance__placeholder--crashed">
			{{ t('employee_portal', 'This content failed to load.') }}
		</p>
		<component
			:is="mode === 'edit' ? webpartTypes[webpart.type].edit : webpartTypes[webpart.type].view"
			v-else
			:data="getWebpartData(webpart)"
			@update:data="emit('update:data', $event)" />
	</div>
</template>

<style scoped>
.webpart-instance__placeholder {
	color: var(--color-text-maxcontrast);
	font-style: italic;
}
</style>
