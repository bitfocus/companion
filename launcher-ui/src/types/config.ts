export interface LauncherConfig {
	http_port: number
	bind_ip: string
	start_minimised: boolean
	run_at_login: boolean
	enable_developer: boolean
	dev_modules_path: string
	log_level: string
	enable_syslog: boolean
	syslog_host: string
	syslog_port: number
	syslog_use_tcp: boolean
	syslog_local_hostname: string
	enable_shell_command_support: boolean
	enable_restricted_modules: boolean
	trusted_proxies: string
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
	hostname: string
}
