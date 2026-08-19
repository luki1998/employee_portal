/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'

/**
 * @typedef {object} Page
 * @property {string} path Path of the page, relative to the portal folder
 * @property {string} title File name without the .md extension
 * @property {number} fileId Nextcloud file id
 * @property {number} mtime Last modification time, in seconds
 * @property {number} size Size in bytes
 * @property {boolean} writable Whether the current user may edit the page
 */

/**
 * Build the URL of a single page.
 *
 * @param {string} path Path of the page, relative to the portal folder
 * @return {string}
 */
function pageUrl(path) {
	return generateOcsUrl('/apps/employee_portal/api/v1/pages/{path}', { path })
}

/**
 * Build the URL of a Site's page collection.
 *
 * @param {string} site Name of the Site
 * @return {string}
 */
function siteUrl(site) {
	return generateOcsUrl('/apps/employee_portal/api/v1/sites/{site}/pages', { site })
}

/**
 * List all pages of a Site.
 *
 * @param {string} site Name of the Site
 * @return {Promise<Page[]>}
 */
export async function fetchPages(site) {
	const { data } = await axios.get(siteUrl(site))

	return data.ocs.data
}

/**
 * Fetch a single page including its markdown source.
 *
 * @param {string} path Path of the page, relative to the portal folder
 * @return {Promise<Page & { content: string }>}
 */
export async function fetchPage(path) {
	const { data } = await axios.get(pageUrl(path))

	return data.ocs.data
}

/**
 * Save a page, creating it when it does not exist yet.
 *
 * @param {string} path Path of the page, relative to the portal folder
 * @param {string} content Markdown source of the page
 * @return {Promise<Page>}
 */
export async function savePage(path, content) {
	const { data } = await axios.put(pageUrl(path), { content })

	return data.ocs.data
}
