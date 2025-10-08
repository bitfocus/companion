/// <reference types="vite/client" />

interface ViteTypeOptions {
	// By adding this line, you can make the type of ImportMetaEnv strict
	// to disallow unknown keys.
	strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
	readonly VITE_SENTRY_DSN: string
	readonly VITE_DISABLE_WHATS_NEW: string
	// more env variables...
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

declare global {
	interface Window {
		// Injected in the html file, to be populated by vite
		ROOT_URL: string
	}
}
