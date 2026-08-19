<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\EmployeePortal;

/**
 * @psalm-type EmployeePortalSite = array{
 *     name: string,
 * }
 *
 * @psalm-type EmployeePortalPage = array{
 *     path: string,
 *     title: string,
 *     fileId: int,
 *     mtime: int,
 *     size: int,
 *     writable: bool,
 * }
 *
 * @psalm-type EmployeePortalPageContent = array{
 *     path: string,
 *     title: string,
 *     fileId: int,
 *     mtime: int,
 *     size: int,
 *     writable: bool,
 *     content: string,
 * }
 */
class ResponseDefinitions {
}
