import fs from 'node:fs/promises'
import path from 'node:path'

const HELP_ASSET_EXTENSIONS = /\.(jpe?g|gif|png|pdf|companionconfig|md)$/

export interface ResolvedHelpAsset {
	/** The real (symlink-free) path of the module's help directory */
	root: string
	/** The real path of the asset, relative to `root` */
	relativePath: string
}

/**
 * Resolve a requested module help asset to the file that will actually be read, following symlinks.
 * Returns null unless that file is inside the real help directory and has an allowed extension, so a
 * symlink inside the module can't be used to serve a file from elsewhere on disk.
 */
export async function resolveHelpAssetPath(helpDir: string, requestedPath: string): Promise<ResolvedHelpAsset | null> {
	if (!HELP_ASSET_EXTENSIONS.test(requestedPath)) return null

	let root: string
	let realFile: string
	try {
		root = await fs.realpath(helpDir)
		realFile = await fs.realpath(path.join(root, requestedPath))
	} catch (_e) {
		// Doesn't exist, or a dangling link
		return null
	}

	const relativePath = path.relative(root, realFile)
	if (
		!relativePath ||
		relativePath === '..' ||
		relativePath.startsWith('..' + path.sep) ||
		path.isAbsolute(relativePath)
	) {
		return null
	}

	// A link with an allowed name must also point at an allowed kind of file
	if (!HELP_ASSET_EXTENSIONS.test(relativePath)) return null

	return { root, relativePath }
}
