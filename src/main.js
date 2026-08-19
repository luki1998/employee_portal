/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import axios from '@nextcloud/axios'
import { createApp } from 'vue'
import App from './App.vue'
import './assets/rich-content.css'

axios.defaults.headers.common['OCS-APIRequest'] = 'true'

createApp(App).mount('#employee_portal')
