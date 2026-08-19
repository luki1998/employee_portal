/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createAppConfig } from '@nextcloud/vite-config'
import { join, resolve } from 'path'

export default createAppConfig({
	main: resolve(join('src', 'main.js')),
}, {
	inlineCSS: { relativeCSSInjection: true },
	extractLicenseInformation: true,
})
