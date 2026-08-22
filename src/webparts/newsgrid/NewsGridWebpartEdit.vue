<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import NewsGridWebpartView from './NewsGridWebpartView.vue'

defineProps({
	data: {
		type: Object,
		default: () => ({ items: [], allNewsLink: '' }),
	},
})
</script>

<template>
	<!--
		No item-level editing UI exists yet (see spec Out of Scope) - the canvas
		shows the same read-only card list as view mode, and configuration
		(currently just "All news link") lives in the Webpart pane instead.
	-->
	<NewsGridWebpartView :data="data" />
</template>
