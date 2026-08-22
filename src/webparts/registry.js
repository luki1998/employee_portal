/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { t } from '@nextcloud/l10n'
import NewsGridWebpartEdit from './newsgrid/NewsGridWebpartEdit.vue'
import NewsGridWebpartView from './newsgrid/NewsGridWebpartView.vue'
import RichTextWebpartEdit from './richtext/RichTextWebpartEdit.vue'
import RichTextWebpartView from './richtext/RichTextWebpartView.vue'
import { webpartDefaults } from './defaults.js'

/**
 * Maps a webpart's `type` to its label, its edit/view components, and its
 * default-data factory. The single seam needed to add another webpart type
 * later - not a plugin system.
 */
export const webpartTypes = {
	richtext: {
		get label() {
			return t('employee_portal', 'Text')
		},
		edit: RichTextWebpartEdit,
		view: RichTextWebpartView,
		defaultData: webpartDefaults.richtext,
	},
	newsgrid: {
		get label() {
			return t('employee_portal', 'News grid')
		},
		edit: NewsGridWebpartEdit,
		view: NewsGridWebpartView,
		defaultData: webpartDefaults.newsgrid,
	},
}
