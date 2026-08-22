/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { mdiNewspaperVariantMultipleOutline, mdiTextBoxPlusOutline } from '@mdi/js'
import { t } from '@nextcloud/l10n'
import NewsGridWebpartEdit from './newsgrid/NewsGridWebpartEdit.vue'
import NewsGridWebpartSettings from './newsgrid/NewsGridWebpartSettings.vue'
import NewsGridWebpartView from './newsgrid/NewsGridWebpartView.vue'
import RichTextWebpartEdit from './richtext/RichTextWebpartEdit.vue'
import RichTextWebpartView from './richtext/RichTextWebpartView.vue'
import { webpartDefaults } from './defaults.js'

/**
 * Maps a webpart's `type` to its label, icon, edit/view/settings components,
 * and its default-data factory. `settings` is the type's configuration
 * surface shown in the Webpart pane (see PageLayoutEditor.vue), distinct from
 * the `edit`/`view` canvas content; it is undefined for types with nothing to
 * configure there. The single seam needed to add another webpart type later -
 * not a plugin system.
 */
export const webpartTypes = {
	richtext: {
		get label() {
			return t('employee_portal', 'Text')
		},
		icon: mdiTextBoxPlusOutline,
		edit: RichTextWebpartEdit,
		view: RichTextWebpartView,
		settings: undefined,
		defaultData: webpartDefaults.richtext,
	},
	newsgrid: {
		get label() {
			return t('employee_portal', 'News grid')
		},
		icon: mdiNewspaperVariantMultipleOutline,
		edit: NewsGridWebpartEdit,
		view: NewsGridWebpartView,
		settings: NewsGridWebpartSettings,
		defaultData: webpartDefaults.newsgrid,
	},
}
