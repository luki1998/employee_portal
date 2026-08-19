/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * @typedef {object} Webpart
 * @property {string} id
 * @property {string} type Only 'richtext' exists for now.
 * @property {string} html
 */

/**
 * @typedef {object} Column
 * @property {string} id
 * @property {Webpart[]} webparts
 */

/**
 * @typedef {object} Row
 * @property {string} id
 * @property {Column[]} columns
 * @property {number[]} [widths] Relative (fr-unit) width per column. Only
 *   meaningful for two-column rows; other counts are always equal-width.
 *   Missing or mismatched-length on older/legacy data - treat as equal.
 */

/**
 * @typedef {object} Layout
 * @property {number} version
 * @property {Row[]} rows
 */

export const MAX_COLUMNS = 3

/**
 * Generates a locally-unique id. Not crypto.randomUUID(): that throws outside
 * a secure context, and this app is also used over plain HTTP in development.
 *
 * @param {string} prefix Short tag identifying what kind of id this is
 * @return {string}
 */
export function createId(prefix) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * @param {string} [html]
 * @return {Webpart}
 */
export function createRichTextWebpart(html = '') {
	return { id: createId('wp'), type: 'richtext', html }
}

/**
 * @param {number} [columnCount]
 * @return {Row}
 */
export function createRow(columnCount = 1) {
	const count = Math.min(Math.max(columnCount, 1), MAX_COLUMNS)

	return {
		id: createId('row'),
		columns: Array.from({ length: count }, () => ({ id: createId('col'), webparts: [createRichTextWebpart()] })),
		widths: Array.from({ length: count }, () => 1),
	}
}

/**
 * @return {Layout}
 */
export function createEmptyLayout() {
	return { version: 1, rows: [createRow()] }
}

/**
 * Checks whether a parsed JSON value has the shape of a layout. Deliberately
 * shallow - components render defensively for anything malformed deeper down,
 * since the JSON is user-editable via WebDAV.
 *
 * @param {unknown} value
 * @return {value is Layout}
 */
function isLayout(value) {
	return typeof value === 'object' && value !== null && Array.isArray(value.rows)
}

/**
 * Interprets a page's stored content as either a layout or legacy markdown.
 *
 * @param {string} content Raw content string as stored in the page file
 * @return {{ kind: 'layout', layout: Layout } | { kind: 'legacy', markdown: string }}
 */
export function parseLayout(content) {
	try {
		const parsed = JSON.parse(content)
		if (isLayout(parsed)) {
			return { kind: 'layout', layout: parsed }
		}
	} catch {
		// Not JSON - falls through to the legacy markdown case below.
	}

	return { kind: 'legacy', markdown: content }
}

/**
 * @param {Layout} layout
 * @return {string}
 */
export function serializeLayout(layout) {
	return JSON.stringify(layout, null, 2)
}

/**
 * Upgrades legacy markdown content into a single-row/single-column layout
 * holding one richtext webpart, called the first time a legacy page is
 * edited.
 *
 * @param {string} markdown Legacy markdown source
 * @param {(markdown: string) => string} renderMarkdown Renders markdown to sanitized HTML
 * @return {Layout}
 */
export function convertMarkdownToLayout(markdown, renderMarkdown) {
	const row = createRow(1)
	row.columns[0].webparts = [createRichTextWebpart(renderMarkdown(markdown))]

	return { version: 1, rows: [row] }
}

/**
 * @param {Layout} layout
 * @return {Row}
 */
export function addRow(layout) {
	const row = createRow()
	layout.rows.push(row)

	return row
}

/**
 * @param {Layout} layout
 * @param {string} rowId
 */
export function removeRow(layout, rowId) {
	const index = layout.rows.findIndex((row) => row.id === rowId)
	if (index !== -1) {
		layout.rows.splice(index, 1)
	}
}

/**
 * @param {Layout} layout
 * @param {string} rowId
 * @param {-1 | 1} direction
 */
export function moveRow(layout, rowId, direction) {
	const index = layout.rows.findIndex((row) => row.id === rowId)
	const target = index + direction
	if (index === -1 || target < 0 || target >= layout.rows.length) {
		return
	}

	const [row] = layout.rows.splice(index, 1)
	layout.rows.splice(target, 0, row)
}

/**
 * Sets a row's column count, clamped to [1, MAX_COLUMNS]. Growing pads with
 * empty columns. Shrinking truncates, but first merges the webparts of the
 * dropped columns into the last surviving column - in order, appended after
 * whatever that column already held - so no content is lost. A no-op on the
 * column widths (see setColumnWidths) resets them to equal whenever the
 * count actually changes.
 *
 * @param {Layout} layout
 * @param {string} rowId
 * @param {number} count
 */
export function setColumnCount(layout, rowId, count) {
	const row = layout.rows.find((row) => row.id === rowId)
	if (!row) {
		return
	}

	const target = Math.min(Math.max(count, 1), MAX_COLUMNS)
	if (target === row.columns.length) {
		return
	}

	if (target < row.columns.length) {
		const dropped = row.columns.slice(target)
		row.columns[target - 1].webparts.push(...dropped.flatMap((column) => column.webparts))
		row.columns.length = target
	} else {
		while (row.columns.length < target) {
			row.columns.push({ id: createId('col'), webparts: [] })
		}
	}

	row.widths = Array.from({ length: target }, () => 1)
}

/**
 * Sets a two-column row's relative width ratio, e.g. [1, 1] for 50/50 or
 * [1, 2] for 33/67. No-op for rows that don't currently have exactly two
 * columns - ratios only apply there, see the Row typedef.
 *
 * @param {Layout} layout
 * @param {string} rowId
 * @param {[number, number]} widths
 */
export function setColumnWidths(layout, rowId, widths) {
	const row = layout.rows.find((row) => row.id === rowId)
	if (!row || row.columns.length !== 2) {
		return
	}

	row.widths = [...widths]
}

/**
 * @param {Row} row
 * @return {string} A CSS grid-template-columns value for the row's widths.
 */
export function getGridTemplateColumns(row) {
	const widths = Array.isArray(row.widths) && row.widths.length === row.columns.length
		? row.widths
		: row.columns.map(() => 1)

	return widths.map((width) => `${width}fr`).join(' ')
}

/**
 * @param {Layout} layout
 * @param {string} rowId
 * @param {string} columnId
 * @param {string} [type]
 * @return {Webpart | undefined}
 */
export function addWebpart(layout, rowId, columnId, type = 'richtext') {
	const column = layout.rows.find((row) => row.id === rowId)?.columns.find((column) => column.id === columnId)
	if (!column) {
		return undefined
	}

	const webpart = type === 'richtext' ? createRichTextWebpart() : undefined
	if (webpart) {
		column.webparts.push(webpart)
	}

	return webpart
}

/**
 * @param {Layout} layout
 * @param {string} rowId
 * @param {string} columnId
 * @param {string} webpartId
 */
export function removeWebpart(layout, rowId, columnId, webpartId) {
	const column = layout.rows.find((row) => row.id === rowId)?.columns.find((column) => column.id === columnId)
	if (!column) {
		return
	}

	const index = column.webparts.findIndex((webpart) => webpart.id === webpartId)
	if (index !== -1) {
		column.webparts.splice(index, 1)
	}
}
