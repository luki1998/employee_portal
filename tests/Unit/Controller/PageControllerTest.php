<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\EmployeePortal\Tests\Unit\Controller;

use OCA\EmployeePortal\Controller\PageController;
use OCA\EmployeePortal\Service\PageService;
use OCP\AppFramework\Http;
use OCP\AppFramework\OCS\OCSBadRequestException;
use OCP\AppFramework\OCS\OCSForbiddenException;
use OCP\AppFramework\OCS\OCSNotFoundException;
use OCP\Files\InvalidPathException;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PageControllerTest extends TestCase {
	private PageService&MockObject $pageService;
	private PageController $controller;

	protected function setUp(): void {
		parent::setUp();

		$this->pageService = $this->createMock(PageService::class);
		$this->controller = new PageController(
			'employee_portal',
			$this->createMock(IRequest::class),
			$this->pageService,
			'testuser',
		);
	}

	public function testIndexReturnsPagesFromService(): void {
		$pages = [['path' => 'welcome.md', 'title' => 'welcome', 'fileId' => 1, 'mtime' => 1, 'size' => 1, 'writable' => true]];
		$this->pageService->method('findAll')->with('testuser', 'General')->willReturn($pages);

		$response = $this->controller->index('General');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame($pages, $response->getData());
	}

	public function testIndexTurnsNotPermittedIntoForbidden(): void {
		$this->pageService->method('findAll')->willThrowException(new NotPermittedException());

		$this->expectException(OCSForbiddenException::class);

		$this->controller->index('General');
	}

	public function testIndexTurnsNotFoundIntoOCSNotFound(): void {
		$this->pageService->method('findAll')->willThrowException(new NotFoundException());

		$this->expectException(OCSNotFoundException::class);

		$this->controller->index('Marketing');
	}

	public function testListSitesReturnsSitesFromService(): void {
		$sites = [['name' => 'General'], ['name' => 'Marketing']];
		$this->pageService->method('listSites')->with('testuser')->willReturn($sites);

		$response = $this->controller->listSites();

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame($sites, $response->getData());
	}

	public function testListSitesTurnsNotPermittedIntoForbidden(): void {
		$this->pageService->method('listSites')->willThrowException(new NotPermittedException());

		$this->expectException(OCSForbiddenException::class);

		$this->controller->listSites();
	}

	public function testCreateSiteReturnsCreatedSite(): void {
		$site = ['name' => 'Marketing'];
		$this->pageService->method('createSite')->with('testuser', 'Marketing')->willReturn($site);

		$response = $this->controller->createSite('Marketing');

		$this->assertSame(Http::STATUS_CREATED, $response->getStatus());
		$this->assertSame($site, $response->getData());
	}

	public function testCreateSiteTurnsInvalidPathIntoBadRequest(): void {
		$this->pageService->method('createSite')->willThrowException(new InvalidPathException('bad name'));

		$this->expectException(OCSBadRequestException::class);

		$this->controller->createSite('..');
	}

	public function testCreateSiteTurnsNotPermittedIntoForbidden(): void {
		$this->pageService->method('createSite')->willThrowException(new NotPermittedException());

		$this->expectException(OCSForbiddenException::class);

		$this->controller->createSite('Marketing');
	}

	public function testShowReturnsPageWithContent(): void {
		$page = ['path' => 'welcome.md', 'title' => 'welcome', 'fileId' => 1, 'mtime' => 1, 'size' => 1, 'writable' => true];
		$this->pageService->method('read')
			->with('testuser', 'welcome.md')
			->willReturn(['page' => $page, 'content' => '# Hello']);

		$response = $this->controller->show('welcome.md');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame($page + ['content' => '# Hello'], $response->getData());
	}

	public function testShowTurnsInvalidPathIntoBadRequest(): void {
		$this->pageService->method('read')->willThrowException(new InvalidPathException('bad path'));

		$this->expectException(OCSBadRequestException::class);

		$this->controller->show('welcome.txt');
	}

	public function testShowTurnsNotPermittedIntoForbidden(): void {
		$this->pageService->method('read')->willThrowException(new NotPermittedException());

		$this->expectException(OCSForbiddenException::class);

		$this->controller->show('welcome.md');
	}

	public function testShowTurnsNotFoundIntoOCSNotFound(): void {
		$this->pageService->method('read')->willThrowException(new NotFoundException());

		$this->expectException(OCSNotFoundException::class);

		$this->controller->show('missing.md');
	}

	public function testSaveReturnsCreatedStatusForNewPages(): void {
		$page = ['path' => 'new.md', 'title' => 'new', 'fileId' => 2, 'mtime' => 2, 'size' => 0, 'writable' => true];
		$this->pageService->method('write')
			->with('testuser', 'new.md', 'content')
			->willReturn(['page' => $page, 'created' => true]);

		$response = $this->controller->save('new.md', 'content');

		$this->assertSame(Http::STATUS_CREATED, $response->getStatus());
		$this->assertSame($page, $response->getData());
	}

	public function testSaveReturnsOkStatusForExistingPages(): void {
		$page = ['path' => 'existing.md', 'title' => 'existing', 'fileId' => 3, 'mtime' => 3, 'size' => 5, 'writable' => true];
		$this->pageService->method('write')
			->willReturn(['page' => $page, 'created' => false]);

		$response = $this->controller->save('existing.md', 'content');

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
	}

	public function testSaveTurnsInvalidPathIntoBadRequest(): void {
		$this->pageService->method('write')->willThrowException(new InvalidPathException('bad path'));

		$this->expectException(OCSBadRequestException::class);

		$this->controller->save('welcome.txt', 'content');
	}

	public function testSaveTurnsNotPermittedIntoForbidden(): void {
		$this->pageService->method('write')->willThrowException(new NotPermittedException());

		$this->expectException(OCSForbiddenException::class);

		$this->controller->save('welcome.md', 'content');
	}

	public function testSaveTurnsNotFoundIntoOCSNotFound(): void {
		$this->pageService->method('write')->willThrowException(new NotFoundException());

		$this->expectException(OCSNotFoundException::class);

		$this->controller->save('Marketing/new.md', 'content');
	}
}
