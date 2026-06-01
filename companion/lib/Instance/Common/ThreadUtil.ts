const ensureFileUrl = (url: string) => {
	if (process.platform === 'win32' && !url.startsWith('file://')) {
		// Windows is picky about import paths, this is a crude hack to 'fix' it
		return `file://${url}`
	} else {
		return url
	}
}

export async function importModuleFromPath(modulePath: string): Promise<any> {
	return import(ensureFileUrl(modulePath))
}
