import z from 'zod'
import { ExportFormatDefault, zodExportFormat } from './ExportFormat.js'
import { ButtonGraphicsDecorationType } from './StyleModel.js'

export const UserConfigGridSizeSchema = z.object({
	minColumn: z.number(),
	maxColumn: z.number(),
	minRow: z.number(),
	maxRow: z.number(),
})
export type UserConfigGridSize = z.output<typeof UserConfigGridSizeSchema>

export const PreviousBackupInfoSchema = z.object({
	filePath: z.string(),
	fileSize: z.number(),
	createdAt: z.number(),
})
export type PreviousBackupInfo = z.output<typeof PreviousBackupInfoSchema>

const DEFAULT_BACKUP_NAME_PATTERN = 'backup-$(internal:date_iso)-$(internal:time_h)$(internal:time_m)'

export const BackupRulesConfigSchema = z.object({
	id: z.string(),
	name: z.string().default('Backup'),
	cron: z.string().default('0 0 * * *'),
	enabled: z.boolean().default(false),
	keep: z.number().default(5),
	backupType: z.enum(['db', 'export-gz', 'export-json', 'export-yaml']).default('db'),
	backupPath: z.string().default(''),
	backupNamePattern: z.string().default(DEFAULT_BACKUP_NAME_PATTERN),

	lastRan: z.number().default(0),

	previousBackups: z.array(PreviousBackupInfoSchema).default(() => []),
})
export type BackupRulesConfig = z.output<typeof BackupRulesConfigSchema>

/** A number setting. Old configs stored some as the string typed in */
function numberSetting(defaultValue: number) {
	return z
		.preprocess(
			(value) =>
				typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value,
			z.number()
		)
		.default(defaultValue)
}

/**
 * The user config, with the defaults of a new config. An existing config is given the settings it had before each was
 * added by the db upgrades, where those differ. Settings no longer used are dropped
 */
export const UserConfigModelSchema = z.object({
	setup_wizard: numberSetting(0),
	detailed_data_collection: z.boolean().default(true),

	page_direction_flipped: z.boolean().default(false),
	page_plusminus: z.boolean().default(false),
	buttons_decoration: z
		.enum([ButtonGraphicsDecorationType.TopBar, ButtonGraphicsDecorationType.Border, ButtonGraphicsDecorationType.None])
		.default(ButtonGraphicsDecorationType.TopBar),
	buttons_status_icons: z.enum(['show', 'none']).default('show'),

	usb_hotplug: z.boolean().default(true),
	auto_enable_discovered_surfaces: z.boolean().default(true),

	satellite_subscriptions_enabled: z.boolean().default(false),

	pin_enable: z.boolean().default(false),
	link_lockouts: z.boolean().default(false),
	pin: z.string().default(''),
	pin_timeout: numberSetting(0),

	http_api_enabled: z.boolean().default(true),
	http_legacy_api_enabled: z.boolean().default(false),

	rest_api_enabled: z.boolean().default(false),
	prometheus_enabled: z.boolean().default(false),
	prometheus_token: z.string().default(''),

	tcp_enabled: z.boolean().default(false),
	tcp_listen_port: numberSetting(16759),
	tcp_legacy_api_enabled: z.boolean().default(false),

	udp_enabled: z.boolean().default(false),
	udp_listen_port: numberSetting(16759),
	udp_legacy_api_enabled: z.boolean().default(false),

	osc_enabled: z.boolean().default(false),
	osc_listen_port: numberSetting(12321),
	osc_legacy_api_enabled: z.boolean().default(false),

	rosstalk_enabled: z.boolean().default(false),

	emberplus_enabled: z.boolean().default(false),

	artnet_enabled: z.boolean().default(false),
	artnet_universe: numberSetting(1),
	artnet_channel: numberSetting(1),

	https_enabled: z.boolean().default(false),
	https_port: numberSetting(8443),
	https_cert_type: z.string().default('self'),
	https_self_cn: z.string().default(''),
	https_self_expiry: numberSetting(365),
	https_self_cert: z.string().default(''),
	https_self_cert_created: z.string().default(''),
	https_self_cert_cn: z.string().default(''),
	https_self_cert_expiry: z.string().default(''),
	https_self_cert_private: z.string().default(''),
	https_self_cert_public: z.string().default(''),
	https_ext_private_key: z.string().default(''),
	https_ext_certificate: z.string().default(''),
	https_ext_chain: z.string().default(''),

	admin_lockout: z.boolean().default(false),
	admin_timeout: numberSetting(5),
	admin_password: z.string().default(''),

	gridSize: UserConfigGridSizeSchema.default(() => ({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })),
	gridSizePromptGrow: z.boolean().default(true),

	installName: z.string().default(''),
	mdns_announcements_enabled: z.boolean().default(true),
	default_export_filename: z
		.string()
		.default('$(internal:hostname)_$(internal:date_iso)-$(internal:time_h)$(internal:time_m)'),
	default_export_format: zodExportFormat.default(ExportFormatDefault),

	/** IANA timezone name (e.g. 'America/New_York') used for internal time variables and time-based triggers. Empty = system timezone. */
	timezone: z.string().default(''),

	backups: z.array(BackupRulesConfigSchema).default((): BackupRulesConfig[] => [
		// Create a disabled backup rule by default
		{
			id: 'default',
			enabled: false,
			name: 'Daily Backup',
			backupType: 'db',
			backupPath: '', // Default
			cron: '0 0 * * *', // Daily at midnight
			backupNamePattern: DEFAULT_BACKUP_NAME_PATTERN,
			keep: 5,
			previousBackups: [],
			lastRan: 0,
		},
	]),
})
export type UserConfigModel = z.output<typeof UserConfigModelSchema>

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
