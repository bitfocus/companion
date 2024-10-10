export interface UserModuleEntry {
	dirname: string
	moduleId: string
	moduleVersion: string
	enabled: boolean
}

export interface UserModuleStatus {
	dirname: string
	status: 'loaded' | 'unloaded' | 'mismatch'
}
