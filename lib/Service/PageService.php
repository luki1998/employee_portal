<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\EmployeePortal\Service;

use OCA\EmployeePortal\ResponseDefinitions;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\InvalidPathException;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Share\IManager;
use OCP\Share\IShare;

/**
 * Reads and writes portal pages, scoped to a Site.
 *
 * Every operation goes through \OCP\Files, so read/write access is decided by
 * Nextcloud's own file permissions: an unauthorized operation throws
 * NotPermittedException from the storage layer. This app deliberately has no
 * permission model of its own.
 *
 * @psalm-import-type EmployeePortalPage from ResponseDefinitions
 * @psalm-import-type EmployeePortalSite from ResponseDefinitions
 */
class PageService {
	/** Top level folder in the user's storage holding every Site. */
	public const PORTAL_FOLDER = 'EmployeePortal';

	/**
	 * The Site every install starts with. Also where legacy flat pages (from
	 * before Sites existed) are migrated to.
	 */
	public const DEFAULT_SITE = 'General';

	public const PAGE_EXTENSION = '.md';

	public function __construct(
		private IRootFolder $rootFolder,
		private IManager $shareManager,
	) {
	}

	/**
	 * Lists every Site the current user can see.
	 *
	 * Site creators - users with access to the portal folder itself, own or
	 * shared - see every immediate child folder of it. Everyone else (Site
	 * members) sees exactly the Sites directly shared with them; an empty
	 * list means nothing has been shared with them yet, not an error.
	 *
	 * @return list<EmployeePortalSite>
	 */
	public function listSites(string $userId): array {
		$portal = $this->findPortalFolder($userId);

		$siteFolders = $portal !== null
			? array_values(array_filter($portal->getDirectoryListing(), static fn ($node): bool => $node instanceof Folder))
			: $this->getDirectlySharedSiteFolders($userId);

		$sites = array_map(static fn (Folder $folder): array => ['name' => $folder->getName()], $siteFolders);

		usort($sites, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));

		return $sites;
	}

	/**
	 * Creates a new Site as a folder directly inside the portal folder.
	 * Restricted to Site creators: users with write access to the portal
	 * folder, the same population that can already list every Site.
	 *
	 * @return EmployeePortalSite
	 *
	 * @throws InvalidPathException
	 * @throws \OCP\Files\NotPermittedException The user may not create a Site
	 */
	public function createSite(string $userId, string $name): array {
		$name = trim($name);
		$this->validateSiteName($name);

		$portal = $this->getPortalFolder($userId);
		$portal->newFolder($name);

		return ['name' => $name];
	}

	/**
	 * @return list<EmployeePortalPage>
	 *
	 * @throws NotFoundException The Site does not exist
	 *
	 * @throws \OCP\Files\NotPermittedException
	 */
	public function findAll(string $userId, string $site): array {
		$siteFolder = $this->getSiteFolder($userId, $site, create: $site === self::DEFAULT_SITE);

		$pages = [];
		foreach ($siteFolder->getDirectoryListing() as $node) {
			if ($node instanceof File && str_ends_with($node->getName(), self::PAGE_EXTENSION)) {
				$pages[] = $this->formatPage($site, $siteFolder, $node);
			}
		}

		usort($pages, static fn (array $a, array $b): int => strcasecmp($a['title'], $b['title']));

		return $pages;
	}

	/**
	 * @return array{page: EmployeePortalPage, content: string}
	 *
	 * @throws InvalidPathException
	 * @throws NotFoundException The page, or its Site, does not exist
	 *
	 * @throws \OCP\Files\NotPermittedException The user may not read the page
	 */
	public function read(string $userId, string $path): array {
		['site' => $site, 'page' => $page] = $this->parsePath($path);
		$siteFolder = $this->getSiteFolder($userId, $site);
		$file = $this->getPage($siteFolder, $page);

		return [
			'page' => $this->formatPage($site, $siteFolder, $file),
			'content' => $file->getContent(),
		];
	}

	/**
	 * Writes a page, creating it when it does not exist yet. The Site itself
	 * must already exist, except for the default Site, which is created on
	 * first use.
	 *
	 * @return array{page: EmployeePortalPage, created: bool}
	 *
	 * @throws InvalidPathException
	 * @throws NotFoundException The page's Site does not exist
	 *
	 * @throws \OCP\Files\NotPermittedException The user may not write the page
	 */
	public function write(string $userId, string $path, string $content): array {
		['site' => $site, 'page' => $page] = $this->parsePath($path);
		$siteFolder = $this->getSiteFolder($userId, $site, create: $site === self::DEFAULT_SITE);

		if ($siteFolder->nodeExists($page)) {
			$file = $this->getPage($siteFolder, $page);
			$file->putContent($content);
			$created = false;
		} else {
			$file = $siteFolder->newFile($page, $content);
			$created = true;
		}

		return [
			'page' => $this->formatPage($site, $siteFolder, $file),
			'created' => $created,
		];
	}

	/**
	 * Returns the portal folder, creating it on first use, and migrates any
	 * legacy flat pages found directly inside it into the default Site.
	 *
	 * @throws \OCP\Files\NotPermittedException
	 */
	private function getPortalFolder(string $userId): Folder {
		$portal = $this->rootFolder->getUserFolder($userId)
			->getOrCreateFolder(self::PORTAL_FOLDER);

		$this->migrateLegacyPages($portal);

		return $portal;
	}

	/**
	 * Returns the portal folder if the user already has one - own or mounted
	 * via a share of the portal folder itself - without creating one. A null
	 * result means this user is not a Site creator: they have no standing to
	 * list the portal's children, and Sites must instead be discovered via
	 * their own direct shares.
	 */
	private function findPortalFolder(string $userId): ?Folder {
		try {
			$portal = $this->rootFolder->getUserFolder($userId)->get(self::PORTAL_FOLDER);
		} catch (NotFoundException) {
			return null;
		}

		if (!$portal instanceof Folder) {
			return null;
		}

		$this->migrateLegacyPages($portal);

		return $portal;
	}

	/**
	 * Site members - anyone without their own or shared access to the portal
	 * folder - are discovered via folders shared directly with them, filtered
	 * to genuine Sites: ones that structurally descend from their owner's own
	 * canonical portal folder, per ADR 0001.
	 *
	 * @return list<Folder>
	 */
	private function getDirectlySharedSiteFolders(string $userId): array {
		$recipientFolder = $this->rootFolder->getUserFolder($userId);

		$sites = [];
		foreach ([IShare::TYPE_USER, IShare::TYPE_GROUP] as $shareType) {
			foreach ($this->shareManager->getSharedWith($userId, $shareType, limit: -1) as $share) {
				$folder = $this->resolveGenuineSharedSiteFolder($share, $recipientFolder);
				if ($folder !== null) {
					// Keyed by file id: the same folder can be reachable via
					// more than one share (e.g. direct and via a group).
					$sites[$folder->getId()] = $folder;
				}
			}
		}

		return array_values($sites);
	}

	/**
	 * Resolves a share to the Site folder as it appears in the *recipient's*
	 * own tree - so subsequent reads/writes are subject to the recipient's
	 * own permissions, not the owner's - but only once verified as a genuine
	 * Site via the owner-side node's actual parent. That verification cannot
	 * be done by browsing up from the recipient's own copy: a share mount has
	 * no accessible parent from the recipient's side, and its display path
	 * isn't trustworthy anyway (see ADR 0001).
	 */
	private function resolveGenuineSharedSiteFolder(IShare $share, Folder $recipientFolder): ?Folder {
		try {
			if ($share->getNodeType() !== 'folder') {
				return null;
			}

			$ownerNode = $share->getNode();
			if (!$ownerNode instanceof Folder) {
				return null;
			}

			$ownerPortal = $this->rootFolder->getUserFolder($share->getShareOwner())->get(self::PORTAL_FOLDER);
			if ($ownerNode->getParent()->getId() !== $ownerPortal->getId()) {
				return null;
			}
		} catch (NotFoundException|NotPermittedException) {
			return null;
		}

		return $recipientFolder->getFirstNodeById($share->getNodeId());
	}

	/**
	 * Before Sites existed, pages lived directly inside the portal folder.
	 * Moves any such page into the default Site so it keeps working under the
	 * Site-scoped address it's now read and written through. A no-op once
	 * none remain.
	 */
	private function migrateLegacyPages(Folder $portal): void {
		$legacyPages = array_filter(
			$portal->getDirectoryListing(),
			static fn ($node): bool => $node instanceof File && str_ends_with($node->getName(), self::PAGE_EXTENSION),
		);

		if ($legacyPages === []) {
			return;
		}

		$defaultSite = $portal->getOrCreateFolder(self::DEFAULT_SITE);
		foreach ($legacyPages as $file) {
			// Leave it at the portal root rather than overwriting a same-named
			// page that already exists in the default Site.
			if ($defaultSite->nodeExists($file->getName())) {
				continue;
			}

			$file->move($defaultSite->getPath() . '/' . $file->getName());
		}
	}

	/**
	 * @throws NotFoundException The Site does not exist, or isn't one this
	 *                           user has any standing to see (own/shared portal access, or a direct
	 *                           share of the Site itself)
	 *
	 * @throws \OCP\Files\NotPermittedException
	 */
	private function getSiteFolder(string $userId, string $site, bool $create = false): Folder {
		if ($create) {
			// Only ever requested for the default Site: auto-vivifying it
			// (and the portal folder itself, on first use) is what keeps a
			// single-Site install working with zero setup.
			$node = $this->getPortalFolder($userId)->getOrCreateFolder($site);
		} else {
			$portal = $this->findPortalFolder($userId);
			$node = $portal !== null
				? $portal->get($site)
				: $this->findDirectlySharedSiteFolder($userId, $site);
		}

		if (!$node instanceof Folder) {
			throw new NotFoundException('Not a Site: ' . $site);
		}

		return $node;
	}

	/**
	 * @throws NotFoundException No Site by that name is shared with this user
	 */
	private function findDirectlySharedSiteFolder(string $userId, string $site): Folder {
		foreach ($this->getDirectlySharedSiteFolders($userId) as $folder) {
			if ($folder->getName() === $site) {
				return $folder;
			}
		}

		throw new NotFoundException('Not a Site: ' . $site);
	}

	/**
	 * @throws InvalidPathException
	 * @throws NotFoundException
	 */
	private function getPage(Folder $siteFolder, string $page): File {
		$node = $siteFolder->get($page);
		if (!$node instanceof File) {
			throw new NotFoundException('Not a page: ' . $page);
		}

		return $node;
	}

	/**
	 * Splits a `site/page.md` address into its Site and page name, and
	 * validates both. This is path validation only, not an access check -
	 * access is handled by \OCP\Files.
	 *
	 * @return array{site: string, page: string}
	 *
	 * @throws InvalidPathException
	 */
	private function parsePath(string $path): array {
		$segments = explode('/', trim($path, '/'));

		if (count($segments) !== 2 || $segments[0] === '' || $segments[1] === '') {
			throw new InvalidPathException('Pages must be addressed as site/page.md');
		}

		[$site, $page] = $segments;

		$this->validateSiteName($site);

		if (!str_ends_with($page, self::PAGE_EXTENSION) || $page === self::PAGE_EXTENSION) {
			throw new InvalidPathException('Pages must be markdown files');
		}

		return ['site' => $site, 'page' => $page];
	}

	/**
	 * @throws InvalidPathException
	 */
	private function validateSiteName(string $site): void {
		if ($site === '' || $site === '.' || $site === '..' || str_contains($site, '/')) {
			throw new InvalidPathException('Invalid Site name: ' . $site);
		}
	}

	/**
	 * @return EmployeePortalPage
	 *
	 * @throws InvalidPathException
	 * @throws NotFoundException
	 */
	private function formatPage(string $site, Folder $siteFolder, File $file): array {
		$relativePath = $siteFolder->getRelativePath($file->getPath());

		return [
			'path' => $site . '/' . ltrim($relativePath ?? $file->getName(), '/'),
			'title' => substr($file->getName(), 0, -strlen(self::PAGE_EXTENSION)),
			'fileId' => $file->getId(),
			'mtime' => $file->getMTime(),
			'size' => (int)$file->getSize(),
			'writable' => $file->isUpdateable(),
		];
	}
}
