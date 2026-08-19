<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import {
	mdiCodeTags,
	mdiFormatBold,
	mdiFormatHeader2,
	mdiFormatHeader3,
	mdiFormatItalic,
	mdiFormatListBulleted,
	mdiFormatListNumbered,
	mdiFormatQuoteClose,
	mdiFormatStrikethrough,
	mdiLink,
	mdiLinkOff,
} from '@mdi/js'
import { t } from '@nextcloud/l10n'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import dompurify from 'dompurify'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'

const props = defineProps({
	modelValue: {
		type: String,
		default: '',
	},
})

const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
	content: dompurify.sanitize(props.modelValue),
	extensions: [
		StarterKit.configure({ link: false }),
		Link.configure({ openOnClick: false, autolink: true }),
	],
	onUpdate: ({ editor }) => emit('update:modelValue', editor.getHTML()),
})

/**
 * Prompts for a URL and applies or removes it as a link on the selection.
 */
function setLink() {
	const previousUrl = editor.value.getAttributes('link').href
	const url = window.prompt(t('employee_portal', 'Link URL'), previousUrl ?? '')

	if (url === null) {
		return
	}

	const chain = editor.value.chain().focus().extendMarkRange('link')
	if (url === '') {
		chain.unsetLink().run()
	} else {
		chain.setLink({ href: url }).run()
	}
}
</script>

<template>
	<div class="richtext-webpart">
		<div v-if="editor" class="richtext-webpart__toolbar">
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('bold')"
				:aria-label="t('employee_portal', 'Bold')"
				@click="editor.chain().focus().toggleBold().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatBold" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('italic')"
				:aria-label="t('employee_portal', 'Italic')"
				@click="editor.chain().focus().toggleItalic().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatItalic" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('strike')"
				:aria-label="t('employee_portal', 'Strikethrough')"
				@click="editor.chain().focus().toggleStrike().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatStrikethrough" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('heading', { level: 2 })"
				:aria-label="t('employee_portal', 'Heading')"
				@click="editor.chain().focus().toggleHeading({ level: 2 }).run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatHeader2" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('heading', { level: 3 })"
				:aria-label="t('employee_portal', 'Subheading')"
				@click="editor.chain().focus().toggleHeading({ level: 3 }).run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatHeader3" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('bulletList')"
				:aria-label="t('employee_portal', 'Bullet list')"
				@click="editor.chain().focus().toggleBulletList().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatListBulleted" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('orderedList')"
				:aria-label="t('employee_portal', 'Numbered list')"
				@click="editor.chain().focus().toggleOrderedList().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatListNumbered" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('blockquote')"
				:aria-label="t('employee_portal', 'Quote')"
				@click="editor.chain().focus().toggleBlockquote().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFormatQuoteClose" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('codeBlock')"
				:aria-label="t('employee_portal', 'Code block')"
				@click="editor.chain().focus().toggleCodeBlock().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiCodeTags" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:pressed="editor.isActive('link')"
				:aria-label="t('employee_portal', 'Link')"
				@click="setLink()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiLink" :size="20" />
				</template>
			</NcButton>
			<NcButton
				variant="tertiary"
				:disabled="!editor.isActive('link')"
				:aria-label="t('employee_portal', 'Remove link')"
				@click="editor.chain().focus().unsetLink().run()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiLinkOff" :size="20" />
				</template>
			</NcButton>
		</div>

		<EditorContent v-if="editor" :editor="editor" class="rich-content richtext-webpart__prosemirror" />
	</div>
</template>

<style scoped lang="scss">
.richtext-webpart {
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.richtext-webpart__toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 2px;
	padding: var(--default-grid-baseline);
	border-block-end: 2px solid var(--color-border);
}

.richtext-webpart__prosemirror {
	padding: calc(var(--default-grid-baseline) * 2);

	:deep(.ProseMirror) {
		min-height: 6em;
		outline: none;
	}
}
</style>
