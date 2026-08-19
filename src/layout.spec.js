/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'
import {
	addRow,
	addWebpart,
	convertMarkdownToLayout,
	createEmptyLayout,
	createRow,
	getGridTemplateColumns,
	MAX_COLUMNS,
	moveRow,
	parseLayout,
	removeRow,
	removeWebpart,
	serializeLayout,
	setColumnCount,
	setColumnWidths,
} from './layout.js'

describe('parseLayout', () => {
	it('recognizes a valid layout', () => {
		const layout = createEmptyLayout()

		const result = parseLayout(JSON.stringify(layout))

		expect(result).toEqual({ kind: 'layout', layout })
	})

	it('falls back to legacy for malformed JSON', () => {
		const result = parseLayout('# Not JSON at all')

		expect(result).toEqual({ kind: 'legacy', markdown: '# Not JSON at all' })
	})

	it('falls back to legacy for valid JSON with the wrong shape', () => {
		const result = parseLayout('{"rows":"nope"}')

		expect(result).toEqual({ kind: 'legacy', markdown: '{"rows":"nope"}' })
	})

	it('falls back to legacy for an empty string', () => {
		const result = parseLayout('')

		expect(result).toEqual({ kind: 'legacy', markdown: '' })
	})
})

describe('serializeLayout', () => {
	it('round-trips through parseLayout', () => {
		const layout = createEmptyLayout()

		const result = parseLayout(serializeLayout(layout))

		expect(result).toEqual({ kind: 'layout', layout })
	})
})

describe('convertMarkdownToLayout', () => {
	it('wraps rendered markdown in a single row/column/webpart', () => {
		const layout = convertMarkdownToLayout('# Hi', (markdown) => `<h1>${markdown}</h1>`)

		expect(layout.rows).toHaveLength(1)
		expect(layout.rows[0].columns).toHaveLength(1)
		expect(layout.rows[0].columns[0].webparts).toEqual([
			expect.objectContaining({ type: 'richtext', html: '<h1># Hi</h1>' }),
		])
	})
})

describe('addRow / removeRow / moveRow', () => {
	it('appends a row with one column and one webpart', () => {
		const layout = { version: 1, rows: [] }

		const row = addRow(layout)

		expect(layout.rows).toEqual([row])
		expect(row.columns).toHaveLength(1)
		expect(row.columns[0].webparts).toHaveLength(1)
	})

	it('removes a row by id', () => {
		const layout = createEmptyLayout()
		const rowId = layout.rows[0].id

		removeRow(layout, rowId)

		expect(layout.rows).toHaveLength(0)
	})

	it('is a no-op when removing an unknown row id', () => {
		const layout = createEmptyLayout()

		removeRow(layout, 'does-not-exist')

		expect(layout.rows).toHaveLength(1)
	})

	it('moves a row up or down', () => {
		const layout = { version: 1, rows: [createRow(), createRow(), createRow()] }
		const [first, second, third] = layout.rows

		moveRow(layout, second.id, -1)
		expect(layout.rows).toEqual([second, first, third])

		moveRow(layout, second.id, 1)
		expect(layout.rows).toEqual([first, second, third])
	})

	it('does not move a row past the start or end', () => {
		const layout = { version: 1, rows: [createRow(), createRow()] }
		const [first, second] = layout.rows

		moveRow(layout, first.id, -1)
		expect(layout.rows).toEqual([first, second])

		moveRow(layout, second.id, 1)
		expect(layout.rows).toEqual([first, second])
	})
})

describe('setColumnCount', () => {
	it('grows a row by padding with empty columns', () => {
		const layout = { version: 1, rows: [createRow(1)] }

		setColumnCount(layout, layout.rows[0].id, 3)

		const row = layout.rows[0]
		expect(row.columns).toHaveLength(3)
		expect(row.columns[1].webparts).toEqual([])
		expect(row.columns[2].webparts).toEqual([])
	})

	it('resets widths to equal when the count changes', () => {
		const layout = { version: 1, rows: [createRow(2)] }
		const rowId = layout.rows[0].id
		setColumnWidths(layout, rowId, [1, 2])

		setColumnCount(layout, rowId, 3)
		expect(layout.rows[0].widths).toEqual([1, 1, 1])

		setColumnCount(layout, rowId, 2)
		expect(layout.rows[0].widths).toEqual([1, 1])
	})

	it('leaves widths untouched when the count does not change', () => {
		const layout = { version: 1, rows: [createRow(2)] }
		const rowId = layout.rows[0].id
		setColumnWidths(layout, rowId, [1, 2])

		setColumnCount(layout, rowId, 2)

		expect(layout.rows[0].widths).toEqual([1, 2])
	})

	it('shrinks a row, merging dropped columns\' webparts into the last remaining column in order', () => {
		const layout = { version: 1, rows: [createRow(3)] }
		const row = layout.rows[0]
		const [first, second, third] = row.columns
		first.webparts = [{ id: 'a', type: 'richtext', html: 'A' }]
		second.webparts = [{ id: 'b', type: 'richtext', html: 'B' }]
		third.webparts = [{ id: 'c', type: 'richtext', html: 'C' }]

		setColumnCount(layout, row.id, 2)

		expect(row.columns).toHaveLength(2)
		expect(row.columns[0].webparts).toEqual([first.webparts[0]])
		expect(row.columns[1].webparts.map((webpart) => webpart.id)).toEqual(['b', 'c'])
	})

	it('shrinking to one column merges every dropped column into it, in order', () => {
		const layout = { version: 1, rows: [createRow(3)] }
		const row = layout.rows[0]
		const [first, second, third] = row.columns
		first.webparts = [{ id: 'a', type: 'richtext', html: 'A' }]
		second.webparts = [{ id: 'b', type: 'richtext', html: 'B' }]
		third.webparts = [{ id: 'c', type: 'richtext', html: 'C' }]

		setColumnCount(layout, row.id, 1)

		expect(row.columns).toHaveLength(1)
		expect(row.columns[0].webparts.map((webpart) => webpart.id)).toEqual(['a', 'b', 'c'])
	})

	it('clamps below 1 and above MAX_COLUMNS', () => {
		const layout = { version: 1, rows: [createRow(1)] }
		const rowId = layout.rows[0].id

		setColumnCount(layout, rowId, 0)
		expect(layout.rows[0].columns).toHaveLength(1)

		setColumnCount(layout, rowId, 99)
		expect(layout.rows[0].columns).toHaveLength(MAX_COLUMNS)
	})
})

describe('setColumnWidths', () => {
	it('sets widths on a two-column row', () => {
		const layout = { version: 1, rows: [createRow(2)] }

		setColumnWidths(layout, layout.rows[0].id, [1, 2])

		expect(layout.rows[0].widths).toEqual([1, 2])
	})

	it('is a no-op for rows that do not have exactly two columns', () => {
		const layout = { version: 1, rows: [createRow(1)] }

		setColumnWidths(layout, layout.rows[0].id, [1, 2])

		expect(layout.rows[0].widths).toEqual([1])
	})
})

describe('getGridTemplateColumns', () => {
	it('uses the row\'s widths when present and matching the column count', () => {
		const row = createRow(2)
		row.widths = [1, 2]

		expect(getGridTemplateColumns(row)).toBe('1fr 2fr')
	})

	it('falls back to equal widths for legacy rows without a widths field', () => {
		const row = createRow(3)
		delete row.widths

		expect(getGridTemplateColumns(row)).toBe('1fr 1fr 1fr')
	})

	it('falls back to equal widths when widths length does not match the column count', () => {
		const row = createRow(3)
		row.widths = [1, 2]

		expect(getGridTemplateColumns(row)).toBe('1fr 1fr 1fr')
	})
})

describe('addWebpart / removeWebpart', () => {
	it('appends a richtext webpart to a column', () => {
		const layout = { version: 1, rows: [createRow(1)] }
		const row = layout.rows[0]
		const column = row.columns[0]

		const webpart = addWebpart(layout, row.id, column.id)

		expect(column.webparts).toHaveLength(2)
		expect(webpart.type).toBe('richtext')
	})

	it('removes a webpart by id', () => {
		const layout = { version: 1, rows: [createRow(1)] }
		const row = layout.rows[0]
		const column = row.columns[0]
		const webpartId = column.webparts[0].id

		removeWebpart(layout, row.id, column.id, webpartId)

		expect(column.webparts).toHaveLength(0)
	})
})
