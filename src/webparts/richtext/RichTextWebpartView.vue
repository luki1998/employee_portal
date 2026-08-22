<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import dompurify from 'dompurify'
import { computed } from 'vue'

const props = defineProps({
	data: {
		type: Object,
		default: () => ({ html: '' }),
	},
})

const sanitized = computed(() => dompurify.sanitize(props.data.html ?? ''))
</script>

<template>
	<!-- eslint-disable-next-line vue/no-v-html -- sanitized above -->
	<div class="rich-content" v-html="sanitized" />
</template>
