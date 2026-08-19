/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'

/**
 * @typedef {object} Site
 * @property {string} name Name of the Site, also its folder name inside the portal
 */

const collectionUrl = generateOcsUrl('/apps/employee_portal/api/v1/sites')

/**
 * List every Site the current user can see.
 *
 * @return {Promise<Site[]>}
 */
export async function fetchSites() {
	const { data } = await axios.get(collectionUrl)

	return data.ocs.data
}

/**
 * Create a new Site.
 *
 * @param {string} name Name of the new Site
 * @return {Promise<Site>}
 */
export async function createSite(name) {
	const { data } = await axios.post(collectionUrl, { name })

	return data.ocs.data
}
