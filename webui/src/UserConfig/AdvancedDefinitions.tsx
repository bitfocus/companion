import { AdminPasswordConfig } from './Sections/AdminPasswordConfig.js'
import { ExperimentsConfig } from './Sections/ExperimentsConfig.js'
import { HttpsConfig } from './Sections/HttpsConfig.js'
import type { SettingsItemDefinition } from './SettingsItems.js'

export const ADVANCED_ITEMS: SettingsItemDefinition[] = [
	{
		id: 'admin-password',
		name: 'Admin UI Password',
		description:
			'Asks for a password before the admin interface can be used, to keep casual users away from the settings.',
		enabledField: 'admin_lockout',
		summary: (config) =>
			!config.admin_lockout
				? 'Anyone can open the admin interface'
				: config.admin_timeout > 0
					? `Locks after ${config.admin_timeout} minutes idle`
					: 'Locks only when asked to',
		docs: '/user-guide/config/settings#admin-ui-password',
		docsLabel: 'Settings guide',
		Settings: AdminPasswordConfig,
		Section: null,
	},
	{
		id: 'https',
		name: 'HTTPS Web Server',
		description:
			'Serves the web interface over HTTPS as well, for deployments that need encrypted transport, with a self-signed or your own certificate.',
		enabledField: 'https_enabled',
		summary: (config) =>
			`Port ${config.https_port} · ${config.https_cert_type === 'external' ? 'Own certificate' : 'Self-signed certificate'}`,
		docs: '/user-guide/config/settings#https-web-server',
		docsLabel: 'Settings guide',
		Settings: HttpsConfig,
		Section: null,
	},
	{
		id: 'experiments',
		name: 'Experiments',
		description: 'Features that are deprecated or still being developed, kept in this browser.',
		enabledField: null,
		summary: () => 'Deprecated and in-development features',
		docs: '/user-guide/config/settings#advanced',
		docsLabel: 'Settings guide',
		Settings: ExperimentsConfig,
		Section: null,
	},
]
