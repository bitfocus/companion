export interface LauncherConfig {
	http_port: number
	bind_ip: string
	start_minimised: boolean
	run_at_login: boolean
	enable_developer: boolean
	dev_modules_path: string
}

export interface AppInfo {
	appVersion: string
	appStatus: string
	appURL: string
	appLaunch: string | null
}

export interface ConfigData {
	config: LauncherConfig
	appInfo: AppInfo
	platform: string
}
