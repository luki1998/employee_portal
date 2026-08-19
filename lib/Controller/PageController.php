<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\EmployeePortal\Controller;

use OCA\EmployeePortal\ResponseDefinitions;
use OCA\EmployeePortal\Service\PageService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCS\OCSBadRequestException;
use OCP\AppFramework\OCS\OCSForbiddenException;
use OCP\AppFramework\OCS\OCSNotFoundException;
use OCP\AppFramework\OCSController;
use OCP\Files\InvalidPathException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IRequest;

/**
 * The API never checks permissions itself: it turns the exceptions raised by
 * \OCP\Files into the matching OCS status codes.
 *
 * @psalm-import-type EmployeePortalPage from ResponseDefinitions
 * @psalm-import-type EmployeePortalPageContent from ResponseDefinitions
 * @psalm-import-type EmployeePortalSite from ResponseDefinitions
 */
class PageController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private PageService $pageService,
		private ?string $userId,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * List every Site the current user can see
	 *
	 * @return DataResponse<Http::STATUS_OK, list<EmployeePortalSite>, array{}>
	 *
	 * @throws OCSForbiddenException The portal folder is not accessible
	 *
	 * 200: Sites returned
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/api/v1/sites')]
	public function listSites(): DataResponse {
		try {
			return new DataResponse($this->pageService->listSites($this->userId));
		} catch (NotPermittedException $e) {
			throw new OCSForbiddenException('No access to the portal folder', $e);
		}
	}

	/**
	 * Create a new Site
	 *
	 * @param string $name Name of the new Site
	 *
	 * @return DataResponse<Http::STATUS_CREATED, EmployeePortalSite, array{}>
	 *
	 * @throws OCSBadRequestException The name is not a valid Site name
	 * @throws OCSForbiddenException The user may not create a Site
	 *
	 * 201: Site created
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/api/v1/sites')]
	public function createSite(string $name): DataResponse {
		try {
			$site = $this->pageService->createSite($this->userId, $name);
		} catch (InvalidPathException $e) {
			throw new OCSBadRequestException($e->getMessage(), $e);
		} catch (NotPermittedException $e) {
			throw new OCSForbiddenException('No permission to create a Site', $e);
		}

		return new DataResponse($site, Http::STATUS_CREATED);
	}

	/**
	 * List all pages of a Site
	 *
	 * @param string $site Name of the Site
	 *
	 * @return DataResponse<Http::STATUS_OK, list<EmployeePortalPage>, array{}>
	 *
	 * @throws OCSForbiddenException The Site is not accessible
	 * @throws OCSNotFoundException The Site does not exist
	 *
	 * 200: Pages returned
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/api/v1/sites/{site}/pages')]
	public function index(string $site): DataResponse {
		try {
			return new DataResponse($this->pageService->findAll($this->userId, $site));
		} catch (NotPermittedException $e) {
			throw new OCSForbiddenException('No access to the portal folder', $e);
		} catch (NotFoundException $e) {
			throw new OCSNotFoundException('Site not found', $e);
		}
	}

	/**
	 * Get the markdown source of a page
	 *
	 * @param string $path Address of the page, as `site/page.md`
	 *
	 * @return DataResponse<Http::STATUS_OK, EmployeePortalPageContent, array{}>
	 *
	 * @throws OCSBadRequestException The path is not a valid page address
	 * @throws OCSForbiddenException The user may not read the page
	 * @throws OCSNotFoundException The page, or its Site, does not exist
	 *
	 * 200: Page returned
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/api/v1/pages/{path}', requirements: ['path' => '.+'])]
	public function show(string $path): DataResponse {
		try {
			['page' => $page, 'content' => $content] = $this->pageService->read($this->userId, $path);
		} catch (InvalidPathException $e) {
			throw new OCSBadRequestException($e->getMessage(), $e);
		} catch (NotPermittedException $e) {
			throw new OCSForbiddenException('No read permission for this page', $e);
		} catch (NotFoundException $e) {
			throw new OCSNotFoundException('Page not found', $e);
		}

		return new DataResponse($page + ['content' => $content]);
	}

	/**
	 * Save the markdown source of a page, creating it if needed
	 *
	 * @param string $path Address of the page, as `site/page.md`
	 * @param string $content Markdown source of the page
	 *
	 * @return DataResponse<Http::STATUS_OK|Http::STATUS_CREATED, EmployeePortalPage, array{}>
	 *
	 * @throws OCSBadRequestException The path is not a valid page address
	 * @throws OCSForbiddenException The user may not write the page
	 * @throws OCSNotFoundException The page's Site does not exist
	 *
	 * 200: Page saved
	 * 201: Page created
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'PUT', url: '/api/v1/pages/{path}', requirements: ['path' => '.+'])]
	public function save(string $path, string $content = ''): DataResponse {
		try {
			['page' => $page, 'created' => $created] = $this->pageService->write($this->userId, $path, $content);
		} catch (InvalidPathException $e) {
			throw new OCSBadRequestException($e->getMessage(), $e);
		} catch (NotPermittedException $e) {
			throw new OCSForbiddenException('No write permission for this page', $e);
		} catch (NotFoundException $e) {
			throw new OCSNotFoundException('Site not found', $e);
		}

		return new DataResponse($page, $created ? Http::STATUS_CREATED : Http::STATUS_OK);
	}
}
