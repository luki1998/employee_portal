<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\EmployeePortal\Tests\Unit\Service;

use OCA\EmployeePortal\Service\PageService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\InvalidPathException;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Share\IManager;
use OCP\Share\IShare;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PageServiceTest extends TestCase {
	private const USER_ID = 'testuser';
	private const MEMBER_ID = 'memberuser';
	private const OWNER_ID = 'owneruser';

	private IRootFolder&MockObject $rootFolder;
	private IManager&MockObject $shareManager;
	private Folder&MockObject $userFolder;
	private Folder&MockObject $portalFolder;
	private Folder&MockObject $generalFolder;
	private PageService $service;

	/**
	 * Backs the single `get()` stub configured below. A single stub reading
	 * this map - rather than one `->method('get')->with(...)->willReturn(...)`
	 * per Site - sidesteps a PHPUnit MockObject quirk where a second
	 * value-returning stub for the same method loses to the first one's
	 * `with()` constraint during verification. Tests that need `get()` to
	 * resolve an additional Site add to this map directly.
	 *
	 * @var array<string, Folder&MockObject>
	 */
	private array $siteFolders;

	/**
	 * Backs `IRootFolder::getUserFolder()`, keyed by user id, so member-path
	 * tests can register a second user with no portal folder of their own
	 * without disturbing the primary (Site creator) fixture.
	 *
	 * @var array<string, Folder&MockObject>
	 */
	private array $userFoldersById;

	/**
	 * Backs the single `getSharedWith()` stub configured below, keyed by
	 * share type - same rationale as `$siteFolders` above: a second
	 * `willReturnCallback()` on the same method loses to the first one under
	 * this PHPUnit version, so tests mutate this map instead of re-stubbing.
	 *
	 * @var array<int, list<IShare&MockObject>>
	 */
	private array $sharesByType;

	protected function setUp(): void {
		parent::setUp();

		$this->rootFolder = $this->createMock(IRootFolder::class);
		$this->shareManager = $this->createMock(IManager::class);
		$this->userFolder = $this->createMock(Folder::class);
		$this->portalFolder = $this->createMock(Folder::class);
		$this->generalFolder = $this->createMock(Folder::class);
		$this->siteFolders = [PageService::DEFAULT_SITE => $this->generalFolder];
		$this->userFoldersById = [self::USER_ID => $this->userFolder];

		$this->rootFolder->method('getUserFolder')
			->willReturnCallback(fn (string $userId) => $this->userFoldersById[$userId]
				?? throw new \RuntimeException('No user folder fixture registered for ' . $userId));
		$this->userFolder->method('getOrCreateFolder')
			->with(PageService::PORTAL_FOLDER)
			->willReturn($this->portalFolder);
		$this->userFolder->method('get')
			->with(PageService::PORTAL_FOLDER)
			->willReturn($this->portalFolder);

		// getDirectoryListing() is left unstubbed: PHPUnit returns an empty
		// array by default for its array return type, meaning "no legacy
		// pages to migrate" unless a test configures otherwise.
		$this->portalFolder->method('getOrCreateFolder')
			->with(PageService::DEFAULT_SITE)
			->willReturn($this->generalFolder);
		$this->portalFolder->method('get')
			->willReturnCallback(fn (string $site) => $this->siteFolders[$site] ?? throw new NotFoundException());

		// No shares by default; member-path tests populate $this->sharesByType.
		$this->sharesByType = [];
		$this->shareManager->method('getSharedWith')
			->willReturnCallback(fn (string $userId, int $shareType) => $this->sharesByType[$shareType] ?? []);

		$this->service = new PageService($this->rootFolder, $this->shareManager);
	}

	/**
	 * Registers a user with no portal folder of their own or mounted via a
	 * share - the state a genuine Site member (never granted portal access)
	 * is in - so `IRootFolder::getUserFolder()` for them resolves to a Folder
	 * whose `get(PORTAL_FOLDER)` throws NotFoundException, same as Nextcloud's
	 * real Files API for a folder that isn't there.
	 */
	private function registerUserWithNoPortalFolder(string $userId): Folder&MockObject {
		$folder = $this->createMock(Folder::class);
		$folder->method('get')
			->with(PageService::PORTAL_FOLDER)
			->willThrowException(new NotFoundException());

		$this->userFoldersById[$userId] = $folder;

		return $folder;
	}

	/**
	 * Builds a share mock for a Folder directly shared with a member, whose
	 * owner-side node (as `IShare::getNode()` resolves it) sits directly
	 * inside the owner's own canonical portal folder - i.e. a genuine Site.
	 *
	 * @param Folder&MockObject $recipientNode The Folder as it appears in the
	 *                                         recipient's own file tree - what read/write operations must use, so
	 *                                         the recipient's own (possibly read-only) permissions apply.
	 */
	private function makeGenuineSiteShare(
		string $name,
		int $fileId,
		Folder&MockObject $recipientNode,
		string $ownerId = self::OWNER_ID,
	): IShare&MockObject {
		$ownerPortal = $this->createMock(Folder::class);
		$ownerPortal->method('getId')->willReturn(999);

		$ownerNode = $this->createMock(Folder::class);
		$ownerNode->method('getParent')->willReturn($ownerPortal);

		$ownerUserFolder = $this->createMock(Folder::class);
		$ownerUserFolder->method('get')->with(PageService::PORTAL_FOLDER)->willReturn($ownerPortal);
		$this->userFoldersById[$ownerId] ??= $ownerUserFolder;

		$recipientNode->method('getName')->willReturn($name);
		$recipientNode->method('getId')->willReturn($fileId);

		$share = $this->createMock(IShare::class);
		$share->method('getNodeType')->willReturn('folder');
		$share->method('getNodeId')->willReturn($fileId);
		$share->method('getNode')->willReturn($ownerNode);
		$share->method('getShareOwner')->willReturn($ownerId);

		return $share;
	}

	/**
	 * Build a File mock with the given name, backed by a site folder.
	 */
	private function createFileMock(
		string $name,
		int $fileId = 1,
		int $mtime = 1000,
		int $size = 42,
		bool $writable = true,
		string $parentPath = PageService::PORTAL_FOLDER . '/' . PageService::DEFAULT_SITE,
	): File&MockObject {
		$file = $this->createMock(File::class);
		$file->method('getName')->willReturn($name);
		$file->method('getPath')->willReturn('/' . self::USER_ID . '/files/' . $parentPath . '/' . $name);
		$file->method('getId')->willReturn($fileId);
		$file->method('getMTime')->willReturn($mtime);
		$file->method('getSize')->willReturn($size);
		$file->method('isUpdateable')->willReturn($writable);

		return $file;
	}

	private function relativeToGeneralCallback(): \Closure {
		$prefix = '/' . self::USER_ID . '/files/' . PageService::PORTAL_FOLDER . '/' . PageService::DEFAULT_SITE;

		return fn (string $path) => str_replace($prefix, '', $path);
	}

	public function testFindAllReturnsOnlyMarkdownFiles(): void {
		$page = $this->createFileMock('welcome.md');
		$folder = $this->createMock(Folder::class);
		$other = $this->createMock(File::class);
		$other->method('getName')->willReturn('logo.png');

		$this->generalFolder->method('getDirectoryListing')
			->willReturn([$page, $folder, $other]);
		$this->generalFolder->method('getRelativePath')
			->willReturnCallback($this->relativeToGeneralCallback());

		$pages = $this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);

		$this->assertCount(1, $pages);
		$this->assertSame('General/welcome.md', $pages[0]['path']);
		$this->assertSame('welcome', $pages[0]['title']);
	}

	public function testFindAllSortsByTitleCaseInsensitively(): void {
		$pages = [
			$this->createFileMock('zebra.md'),
			$this->createFileMock('Alpha.md'),
			$this->createFileMock('mango.md'),
		];

		$this->generalFolder->method('getDirectoryListing')->willReturn($pages);
		$this->generalFolder->method('getRelativePath')
			->willReturnCallback($this->relativeToGeneralCallback());

		$titles = array_column($this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE), 'title');

		$this->assertSame(['Alpha', 'mango', 'zebra'], $titles);
	}

	public function testFindAllFormatsEachPage(): void {
		$file = $this->createFileMock('welcome.md', fileId: 7, mtime: 12345, size: 99, writable: false);
		$this->generalFolder->method('getDirectoryListing')->willReturn([$file]);
		$this->generalFolder->method('getRelativePath')->willReturn('/welcome.md');

		$pages = $this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);

		$this->assertSame([
			'path' => 'General/welcome.md',
			'title' => 'welcome',
			'fileId' => 7,
			'mtime' => 12345,
			'size' => 99,
			'writable' => false,
		], $pages[0]);
	}

	public function testFindAllMigratesLegacyFlatPagesIntoTheDefaultSite(): void {
		$legacy = $this->createFileMock('welcome.md', parentPath: PageService::PORTAL_FOLDER);
		$this->portalFolder->method('getDirectoryListing')->willReturn([$legacy]);
		$this->generalFolder->method('getPath')
			->willReturn('/' . self::USER_ID . '/files/' . PageService::PORTAL_FOLDER . '/' . PageService::DEFAULT_SITE);
		$legacy->expects($this->once())
			->method('move')
			->with('/' . self::USER_ID . '/files/' . PageService::PORTAL_FOLDER . '/' . PageService::DEFAULT_SITE . '/welcome.md');

		$this->generalFolder->method('getDirectoryListing')->willReturn([]);

		$this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);
	}

	public function testFindAllMigratesLegacyPagesOnlyOnce(): void {
		$legacy = $this->createFileMock('welcome.md', parentPath: PageService::PORTAL_FOLDER);
		// First call sees the legacy page still at the portal root; the second
		// call sees it already moved away, simulating the migrated state.
		$this->portalFolder->method('getDirectoryListing')
			->willReturnOnConsecutiveCalls([$legacy], []);
		$this->generalFolder->method('getPath')
			->willReturn('/' . self::USER_ID . '/files/' . PageService::PORTAL_FOLDER . '/' . PageService::DEFAULT_SITE);
		$this->generalFolder->method('getDirectoryListing')->willReturn([]);
		$legacy->expects($this->once())->method('move');

		$this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);
		$this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);
	}

	public function testFindAllDoesNotOverwriteAnExistingPageWithTheSameNameDuringMigration(): void {
		$legacy = $this->createFileMock('welcome.md', parentPath: PageService::PORTAL_FOLDER);
		$this->portalFolder->method('getDirectoryListing')->willReturn([$legacy]);
		$this->generalFolder->method('nodeExists')->with('welcome.md')->willReturn(true);
		$this->generalFolder->method('getDirectoryListing')->willReturn([]);
		$legacy->expects($this->never())->method('move');

		$this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);
	}

	public function testFindAllDoesNotTreatExistingSiteFoldersAsLegacyPages(): void {
		$siteFolder = $this->createMock(Folder::class);
		$this->portalFolder->method('getDirectoryListing')->willReturn([$siteFolder]);
		$this->generalFolder->method('getDirectoryListing')->willReturn([]);

		$pages = $this->service->findAll(self::USER_ID, PageService::DEFAULT_SITE);

		$this->assertSame([], $pages);
	}

	public function testFindAllListsPagesOfANonDefaultSite(): void {
		$marketingFolder = $this->createMock(Folder::class);
		$this->siteFolders['Marketing'] = $marketingFolder;
		$page = $this->createFileMock('welcome.md', parentPath: PageService::PORTAL_FOLDER . '/Marketing');
		$marketingFolder->method('getDirectoryListing')->willReturn([$page]);
		$marketingFolder->method('getRelativePath')->willReturn('/welcome.md');

		$pages = $this->service->findAll(self::USER_ID, 'Marketing');

		$this->assertSame('Marketing/welcome.md', $pages[0]['path']);
	}

	public function testFindAllThrowsNotFoundExceptionForAnUnknownSite(): void {
		$this->portalFolder->method('get')
			->with('Marketing')
			->willThrowException(new NotFoundException());

		$this->expectException(NotFoundException::class);

		$this->service->findAll(self::USER_ID, 'Marketing');
	}

	public function testReadReturnsPageAndContent(): void {
		$file = $this->createFileMock('welcome.md');
		$file->method('getContent')->willReturn('# Hello');

		$this->generalFolder->method('get')->with('welcome.md')->willReturn($file);
		$this->generalFolder->method('getRelativePath')->willReturn('/welcome.md');

		$result = $this->service->read(self::USER_ID, 'General/welcome.md');

		$this->assertSame('# Hello', $result['content']);
		$this->assertSame('General/welcome.md', $result['page']['path']);
	}

	public function testReadThrowsWhenNodeIsNotAFile(): void {
		$folder = $this->createMock(Folder::class);
		$this->generalFolder->method('get')->with('sub.md')->willReturn($folder);

		$this->expectException(NotFoundException::class);

		$this->service->read(self::USER_ID, 'General/sub.md');
	}

	public function testReadThrowsInvalidPathExceptionForNonMarkdownPath(): void {
		$this->expectException(InvalidPathException::class);

		$this->service->read(self::USER_ID, 'General/welcome.txt');
	}

	public function testReadThrowsInvalidPathExceptionWhenSiteIsMissing(): void {
		$this->expectException(InvalidPathException::class);

		$this->service->read(self::USER_ID, 'welcome.md');
	}

	public function testReadThrowsInvalidPathExceptionWhenNestedTooDeeply(): void {
		$this->expectException(InvalidPathException::class);

		$this->service->read(self::USER_ID, 'General/sub/welcome.md');
	}

	public function testReadRejectsTraversalViaTheSiteSegment(): void {
		$this->expectException(InvalidPathException::class);

		$this->service->read(self::USER_ID, '../secrets.md');
	}

	public function testReadThrowsNotFoundExceptionForAnUnknownSite(): void {
		$this->portalFolder->method('get')
			->with('Marketing')
			->willThrowException(new NotFoundException());

		$this->expectException(NotFoundException::class);

		$this->service->read(self::USER_ID, 'Marketing/welcome.md');
	}

	public function testWriteCreatesNewFileWhenItDoesNotExist(): void {
		$file = $this->createFileMock('new.md');
		$this->generalFolder->method('nodeExists')->with('new.md')->willReturn(false);
		$this->generalFolder->expects($this->once())
			->method('newFile')
			->with('new.md', 'content')
			->willReturn($file);
		$this->generalFolder->method('getRelativePath')->willReturn('/new.md');

		$result = $this->service->write(self::USER_ID, 'General/new.md', 'content');

		$this->assertTrue($result['created']);
		$this->assertSame('General/new.md', $result['page']['path']);
	}

	public function testWriteUpdatesExistingFile(): void {
		$file = $this->createFileMock('existing.md');
		$file->expects($this->once())->method('putContent')->with('updated content');

		$this->generalFolder->method('nodeExists')->with('existing.md')->willReturn(true);
		$this->generalFolder->method('get')->with('existing.md')->willReturn($file);
		$this->generalFolder->expects($this->never())->method('newFile');
		$this->generalFolder->method('getRelativePath')->willReturn('/existing.md');

		$result = $this->service->write(self::USER_ID, 'General/existing.md', 'updated content');

		$this->assertFalse($result['created']);
	}

	public function testWriteStripsLeadingAndTrailingSlashes(): void {
		$file = $this->createFileMock('page.md');
		$this->generalFolder->method('nodeExists')->with('page.md')->willReturn(false);
		$this->generalFolder->expects($this->once())
			->method('newFile')
			->with('page.md', '')
			->willReturn($file);
		$this->generalFolder->method('getRelativePath')->willReturn('/page.md');

		$this->service->write(self::USER_ID, '/General/page.md/', '');
	}

	public function testWriteThrowsNotFoundExceptionForAnUnknownSite(): void {
		$this->portalFolder->method('get')
			->with('Marketing')
			->willThrowException(new NotFoundException());

		$this->expectException(NotFoundException::class);

		$this->service->write(self::USER_ID, 'Marketing/new.md', 'content');
	}

	/**
	 * @dataProvider invalidPathProvider
	 */
	public function testWriteRejectsInvalidPaths(string $path): void {
		$this->expectException(InvalidPathException::class);

		$this->service->write(self::USER_ID, $path, '');
	}

	public static function invalidPathProvider(): array {
		return [
			'no site segment' => ['welcome.md'],
			'no extension' => ['General/welcome'],
			'wrong extension' => ['General/welcome.txt'],
			'extension only' => ['General/.md'],
			'site is parent traversal' => ['../secrets.md'],
			'site is current dir' => ['./welcome.md'],
			'nested too deep' => ['General/sub/page.md'],
		];
	}

	public function testListSitesReturnsEveryImmediateSubfolderSortedByName(): void {
		$general = $this->createMock(Folder::class);
		$general->method('getName')->willReturn('General');
		$marketing = $this->createMock(Folder::class);
		$marketing->method('getName')->willReturn('Marketing');
		$this->portalFolder->method('getDirectoryListing')->willReturn([$marketing, $general]);

		$sites = $this->service->listSites(self::USER_ID);

		$this->assertSame(['General', 'Marketing'], array_column($sites, 'name'));
	}

	public function testListSitesIgnoresNonFolderNodes(): void {
		$general = $this->createMock(Folder::class);
		$general->method('getName')->willReturn('General');
		$strayFile = $this->createMock(File::class);
		$strayFile->method('getName')->willReturn('notes.txt');
		$this->portalFolder->method('getDirectoryListing')->willReturn([$general, $strayFile]);

		$sites = $this->service->listSites(self::USER_ID);

		$this->assertSame(['General'], array_column($sites, 'name'));
	}

	public function testCreateSiteCreatesFolderAndReturnsIt(): void {
		$this->portalFolder->expects($this->once())
			->method('newFolder')
			->with('Marketing');

		$site = $this->service->createSite(self::USER_ID, 'Marketing');

		$this->assertSame(['name' => 'Marketing'], $site);
	}

	public function testCreateSiteTrimsTheName(): void {
		$this->portalFolder->expects($this->once())
			->method('newFolder')
			->with('Marketing');

		$site = $this->service->createSite(self::USER_ID, '  Marketing  ');

		$this->assertSame('Marketing', $site['name']);
	}

	/**
	 * @dataProvider invalidSiteNameProvider
	 */
	public function testCreateSiteRejectsInvalidNames(string $name): void {
		$this->expectException(InvalidPathException::class);

		$this->service->createSite(self::USER_ID, $name);
	}

	public static function invalidSiteNameProvider(): array {
		return [
			'empty' => [''],
			'whitespace only' => ['   '],
			'current dir' => ['.'],
			'parent traversal' => ['..'],
			'contains a slash' => ['Marketing/Sales'],
		];
	}

	public function testCreateSitePropagatesNotPermittedExceptionWhenPortalIsNotWritable(): void {
		$this->portalFolder->method('newFolder')
			->willThrowException(new NotPermittedException());

		$this->expectException(NotPermittedException::class);

		$this->service->createSite(self::USER_ID, 'Marketing');
	}

	public function testListSitesForAMemberReturnsSitesFromDirectShares(): void {
		$memberFolder = $this->registerUserWithNoPortalFolder(self::MEMBER_ID);
		$recipientNode = $this->createMock(Folder::class);
		$share = $this->makeGenuineSiteShare('Marketing', 42, $recipientNode);
		$memberFolder->method('getFirstNodeById')->with(42)->willReturn($recipientNode);

		$this->sharesByType[IShare::TYPE_USER] = [$share];

		$sites = $this->service->listSites(self::MEMBER_ID);

		$this->assertSame(['Marketing'], array_column($sites, 'name'));
	}

	public function testListSitesIgnoresASharedFolderThatIsNotAGenuineSite(): void {
		$memberFolder = $this->registerUserWithNoPortalFolder(self::MEMBER_ID);

		// Shared directly, but its owner-side parent is not the owner's
		// canonical portal folder - e.g. some unrelated folder that happens
		// to be shared with this user.
		$unrelatedParent = $this->createMock(Folder::class);
		$unrelatedParent->method('getId')->willReturn(111);
		$ownerNode = $this->createMock(Folder::class);
		$ownerNode->method('getParent')->willReturn($unrelatedParent);

		$ownerPortal = $this->createMock(Folder::class);
		$ownerPortal->method('getId')->willReturn(999);
		$ownerUserFolder = $this->createMock(Folder::class);
		$ownerUserFolder->method('get')->with(PageService::PORTAL_FOLDER)->willReturn($ownerPortal);
		$this->userFoldersById[self::OWNER_ID] = $ownerUserFolder;

		$share = $this->createMock(IShare::class);
		$share->method('getNodeType')->willReturn('folder');
		$share->method('getNodeId')->willReturn(7);
		$share->method('getNode')->willReturn($ownerNode);
		$share->method('getShareOwner')->willReturn(self::OWNER_ID);

		$this->sharesByType[IShare::TYPE_USER] = [$share];

		$sites = $this->service->listSites(self::MEMBER_ID);

		$this->assertSame([], $sites);
	}

	public function testListSitesReturnsEmptyArrayForAUserWithNoPortalAndNoShares(): void {
		$this->registerUserWithNoPortalFolder(self::MEMBER_ID);

		$sites = $this->service->listSites(self::MEMBER_ID);

		$this->assertSame([], $sites);
	}

	public function testFindAllListsPagesOfASiteSharedDirectlyWithAMember(): void {
		$memberFolder = $this->registerUserWithNoPortalFolder(self::MEMBER_ID);
		$recipientNode = $this->createMock(Folder::class);
		$page = $this->createFileMock('welcome.md', parentPath: 'Marketing');
		$recipientNode->method('getDirectoryListing')->willReturn([$page]);
		$recipientNode->method('getRelativePath')->willReturn('/welcome.md');
		$share = $this->makeGenuineSiteShare('Marketing', 42, $recipientNode);
		$memberFolder->method('getFirstNodeById')->with(42)->willReturn($recipientNode);

		$this->sharesByType[IShare::TYPE_USER] = [$share];

		$pages = $this->service->findAll(self::MEMBER_ID, 'Marketing');

		$this->assertSame('Marketing/welcome.md', $pages[0]['path']);
	}

	public function testFindAllThrowsNotFoundExceptionForASiteNotSharedWithTheMember(): void {
		$this->registerUserWithNoPortalFolder(self::MEMBER_ID);

		$this->expectException(NotFoundException::class);

		$this->service->findAll(self::MEMBER_ID, 'Marketing');
	}

	public function testWriteOnASharedSiteUsesTheRecipientsOwnPermissionsNotTheOwners(): void {
		$memberFolder = $this->registerUserWithNoPortalFolder(self::MEMBER_ID);
		$recipientNode = $this->createMock(Folder::class);
		// The member's own share is read-only: their view of the folder
		// throws NotPermittedException on write, exactly like a real
		// read-only mount would - regardless of what the owner could do.
		$recipientNode->method('nodeExists')->with('new.md')->willReturn(false);
		$recipientNode->method('newFile')->willThrowException(new NotPermittedException());
		$share = $this->makeGenuineSiteShare('Marketing', 42, $recipientNode);
		$memberFolder->method('getFirstNodeById')->with(42)->willReturn($recipientNode);

		$this->sharesByType[IShare::TYPE_USER] = [$share];

		$this->expectException(NotPermittedException::class);

		$this->service->write(self::MEMBER_ID, 'Marketing/new.md', 'content');
	}
}
