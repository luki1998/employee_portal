<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { mdiCommentOutline, mdiEyeOutline, mdiImageOutline, mdiPin } from '@mdi/js'
import { t } from '@nextcloud/l10n'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'

defineProps({
	data: {
		type: Object,
		default: () => ({ items: [], allNewsLink: '' }),
	},
})

/**
 * @param {string} date ISO date string
 * @return {string} Locale-formatted date, or the raw string if unparseable
 */
function formatDate(date) {
	const parsed = new Date(date)

	return Number.isNaN(parsed.getTime())
		? date
		: parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Restricts the editor-supplied "All news" link to the http/https schemes,
 * since it's rendered as a plain anchor href with no other sanitization -
 * unlike richtext's html, which is routed through dompurify.
 *
 * @param {string} [link]
 * @return {boolean}
 */
function isSafeLink(link) {
	if (!link) {
		return false
	}

	try {
		return ['http:', 'https:'].includes(new URL(link, window.location.origin).protocol)
	} catch {
		return false
	}
}

/**
 * @param {string} author
 * @return {string} A one-or-two-letter initial for the avatar, derived from
 *   the author's name rather than stored separately on the item.
 */
function initials(author) {
	return (author ?? '')
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('')
}
</script>

<template>
	<div class="newsgrid-webpart">
		<div class="newsgrid-webpart__grid">
			<article v-for="(item, index) in data.items ?? []" :key="index" class="newsgrid-webpart__card">
				<div class="newsgrid-webpart__image">
					<NcIconSvgWrapper :path="mdiImageOutline" :size="32" />
					<span v-if="item.pinned" class="newsgrid-webpart__pinned">
						<NcIconSvgWrapper :path="mdiPin" :size="16" />
						{{ t('employee_portal', 'Pinned') }}
					</span>
				</div>

				<div class="newsgrid-webpart__body">
					<span v-if="item.category" class="newsgrid-webpart__category">{{ item.category }}</span>
					<h3 class="newsgrid-webpart__title">{{ item.title }}</h3>
					<p class="newsgrid-webpart__excerpt">{{ item.excerpt }}</p>
				</div>

				<div class="newsgrid-webpart__footer">
					<span class="newsgrid-webpart__avatar" aria-hidden="true">{{ initials(item.author) }}</span>
					<div class="newsgrid-webpart__meta">
						<span class="newsgrid-webpart__author">{{ item.author }}</span>
						<span class="newsgrid-webpart__date">{{ formatDate(item.date) }}</span>
					</div>
					<span class="newsgrid-webpart__stat">
						<NcIconSvgWrapper :path="mdiEyeOutline" :size="16" />
						{{ item.views }}
					</span>
					<span class="newsgrid-webpart__stat">
						<NcIconSvgWrapper :path="mdiCommentOutline" :size="16" />
						{{ item.comments }}
					</span>
				</div>
			</article>
		</div>

		<a v-if="isSafeLink(data.allNewsLink)" class="newsgrid-webpart__all-news-link" :href="data.allNewsLink">
			{{ t('employee_portal', 'All news') }}
		</a>
	</div>
</template>

<style scoped>
.newsgrid-webpart__grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: calc(var(--default-grid-baseline) * 4);
}

.newsgrid-webpart__card {
	display: flex;
	flex-direction: column;
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large);
	overflow: hidden;
	transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out;
}

.newsgrid-webpart__card:hover {
	transform: translateY(-2px);
	box-shadow: 0 2px 8px var(--color-box-shadow);
}

.newsgrid-webpart__image {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	aspect-ratio: 16 / 9;
	color: var(--color-text-maxcontrast);
	background-color: var(--color-background-dark);
}

.newsgrid-webpart__pinned {
	position: absolute;
	inset-block-start: var(--default-grid-baseline);
	inset-inline-end: var(--default-grid-baseline);
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 8px;
	border-radius: var(--border-radius-pill);
	font-size: 0.8em;
	color: var(--color-primary-element-text);
	background-color: var(--color-primary-element);
}

.newsgrid-webpart__body {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: calc(var(--default-grid-baseline) * 2);
}

.newsgrid-webpart__category {
	align-self: flex-start;
	padding: 2px 8px;
	border-radius: var(--border-radius-pill);
	font-size: 0.8em;
	color: var(--color-text-maxcontrast);
	background-color: var(--color-background-hover);
}

.newsgrid-webpart__title {
	margin: 0;
	font-size: 1.1em;
}

.newsgrid-webpart__excerpt {
	margin: 0;
	color: var(--color-text-maxcontrast);
}

.newsgrid-webpart__footer {
	display: grid;
	grid-template-columns: auto 1fr auto auto;
	align-items: center;
	gap: 8px;
	margin-block-start: auto;
	padding: calc(var(--default-grid-baseline) * 2);
	border-block-start: 2px solid var(--color-border);
}

.newsgrid-webpart__avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	inline-size: 32px;
	block-size: 32px;
	border-radius: 50%;
	font-size: 0.8em;
	font-weight: bold;
	color: var(--color-primary-element-text);
	background-color: var(--color-primary-element);
}

.newsgrid-webpart__meta {
	display: flex;
	flex-direction: column;
	min-inline-size: 0;
	font-size: 0.85em;
	color: var(--color-text-maxcontrast);
}

.newsgrid-webpart__author {
	overflow: hidden;
	color: var(--color-main-text);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.newsgrid-webpart__stat {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 0.85em;
	color: var(--color-text-maxcontrast);
}

.newsgrid-webpart__all-news-link {
	display: inline-block;
	margin-block-start: calc(var(--default-grid-baseline) * 4);
	font-weight: bold;
}
</style>
