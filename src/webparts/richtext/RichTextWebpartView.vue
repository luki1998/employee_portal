<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import dompurify from 'dompurify'
import { computed } from 'vue'

const props = defineProps({
	html: {
		type: String,
		default: '',
	},
})

const sanitized = computed(() => dompurify.sanitize(props.html))
</script>

<template>
	<!-- eslint-disable-next-line vue/no-v-html -- sanitized above -->
	<div class="rich-content" v-html="sanitized" />
</template>
