export interface ModuleManifestMaintainer {
	name: string;
	email?: string;
	github?: string;
}

export interface ModuleManifest {
	id: string;
	name: string;
	version: string;
	license: string;
	repository: string;
	maintainers: ModuleManifestMaintainer[];
	runtime: string;
	api: string;
	entrypoint: string;
	universal: boolean;

	manufacturer: string;
	products?: string[];
	keywords: string[];
}
