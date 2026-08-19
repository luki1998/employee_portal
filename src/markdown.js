/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import dompurify from 'dompurify'
import MarkdownIt from 'markdown-it'

// Raw HTML in the source is not passed through, and the result is sanitized on
// top of that: pages are shared files, so their author is not necessarily the
// reader.
const markdownIt = new MarkdownIt({ html: false, linkify: true })

/**
 * Renders markdown source to sanitized HTML.
 *
 * @param {string} source Markdown source
 * @return {string}
 */
export function renderMarkdown(source) {
	return dompurify.sanitize(markdownIt.render(source))
}
