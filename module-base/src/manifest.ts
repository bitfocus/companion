export interface ModuleManifestMaintainer {
	name: string
	email?: string
	github?: string
}

export interface ModuleManifestRuntime {
	/** Type of the module. Must be: node14 */
	type: string
	/** Which host-api does it use. Must be socket.io */
	api: string

	/** Entrypoint to pass to the runtime. eg index.js */
	entrypoint: string
	// universal: boolean
}

export interface ModuleManifest {
	/** Unique identifier for the module */
	id: string
	/** Name of the module */
	name: string

	shortname: string
	/** Description of the module */
	description: string
	/** Current version of the module */
	version: string
	/** License of the module */
	license: string
	/** URL to the source repository */
	repository: string
	/** URL to bug tracker */
	bugs: string
	/** List of active maintiners */
	maintainers: ModuleManifestMaintainer[]
	/** If the module had a different unique identifier previously, then specify it here */
	legacyIds?: string[]

	/** Information on how to execute the module */
	runtime: ModuleManifestRuntime

	manufacturer: string
	products: string[]
	keywords: string[]
}

/** Validate that a manifest looks correctly populated */
export function validateManifest(manifest: ModuleManifest): void {
	// TODO module-lib
}
