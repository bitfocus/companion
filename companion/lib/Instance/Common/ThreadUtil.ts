const ensureFileUrl = (url: string) => {
	if (process.platform === 'win32' && !url.startsWith('file://')) {
		// Windows is picky about import paths, this is a crude hack to 'fix' it
		return `file://${url}`
	} else {
		return url
	}
}

export async function importModuleFromPath(modulePath: string): Promise<any> {
	// Future: Once webpacked, the dynamic import() doesn't work, so fallback to require()
	return typeof __non_webpack_require__ === 'function'
		? __non_webpack_require__(modulePath)
		: await import(ensureFileUrl(modulePath))
}
