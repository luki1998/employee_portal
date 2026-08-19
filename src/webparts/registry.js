/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { t } from '@nextcloud/l10n'
import RichTextWebpartEdit from './richtext/RichTextWebpartEdit.vue'
import RichTextWebpartView from './richtext/RichTextWebpartView.vue'

/**
 * Maps a webpart's `type` to the components that edit and view it. The single
 * seam needed to add another webpart type later - not a plugin system.
 */
export const webpartTypes = {
	richtext: {
		get label() {
			return t('employee_portal', 'Text')
		},
		edit: RichTextWebpartEdit,
		view: RichTextWebpartView,
	},
}
