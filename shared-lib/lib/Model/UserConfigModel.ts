export type UserConfigModel = {
	setup_wizard: number
	detailed_data_collection: boolean

	page_direction_flipped: boolean
	page_plusminus: boolean
	remove_topbar: boolean

	elgato_plugin_enable: boolean
	usb_hotplug: boolean
	auto_enable_discovered_surfaces: boolean

	pin_enable: boolean
	link_lockouts: boolean
	pin: string
	pin_timeout: number

	http_api_enabled: boolean
	http_legacy_api_enabled: boolean

	tcp_enabled: boolean
	tcp_listen_port: number
	tcp_legacy_api_enabled: boolean

	udp_enabled: boolean
	udp_listen_port: number
	udp_legacy_api_enabled: boolean

	osc_enabled: boolean
	osc_listen_port: number
	osc_legacy_api_enabled: boolean

	rosstalk_enabled: boolean

	emberplus_enabled: boolean

	artnet_enabled: boolean
	artnet_universe: number
	artnet_channel: number

	https_enabled: boolean
	https_port: number
	https_cert_type: string
	https_self_cn: string
	https_self_expiry: number
	https_self_cert: string
	https_self_cert_created: string
	https_self_cert_cn: string
	https_self_cert_expiry: string
	https_self_cert_private: string
	https_self_cert_public: string
	https_ext_private_key: string
	https_ext_certificate: string
	https_ext_chain: string

	admin_lockout: boolean
	admin_timeout: number
	admin_password: string

	gridSize: UserConfigGridSize
	gridSizeInlineGrow: boolean
	gridSizePromptGrow: boolean

	installName: string
	default_export_filename: string

	backups: BackupRulesConfig[]
}

export interface UserConfigGridSize {
	minColumn: number
	maxColumn: number
	minRow: number
	maxRow: number
}

export interface BackupRulesConfig {
	id: string
	name: string
	cron: string
	enabled: boolean
	keep: number
	backupType: 'db' | 'export-gz' | 'export-json' | 'export-yaml'
	backupPath: string
	backupNamePattern: string

	lastRan: number

	previousBackups: PreviousBackupInfo[]
}

export interface PreviousBackupInfo {
	filePath: string
	fileSize: number
	createdAt: number
}

export type UserConfigUpdate = UserConfigUpdateInit | UserConfigUpdateKey

export interface UserConfigUpdateInit {
	type: 'init'
	config: UserConfigModel
}
export interface UserConfigUpdateKey {
	type: 'key'
	key: keyof UserConfigModel
	value: any
}
