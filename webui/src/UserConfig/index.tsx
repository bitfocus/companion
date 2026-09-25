import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import './settings.css'
import { faCog, faFloppyDisk, faGamepad, faNetworkWired, faTh, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, type RegisteredRouter, type ToPathOption } from '@tanstack/react-router'
import { Grid } from '~/Components/Grid'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'

export function SettingsSelectPage(): React.JSX.Element {
	// Not a split: one readable-width column of cards, so this stays on the 12-column grid.
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings" />

			<div className="page-scroll">
				<div className="max-w-5xl">
					<PageIntro title="Companion System Settings">
						Select a configuration category below to adjust installation parameters, protocols, and backups.
					</PageIntro>

					<Grid.Row className="gap-3">
						<SettingsLinkCard
							label="General"
							description="Installation name, mDNS announcements, timezone, export options, and telemetry."
							to="/settings/general"
							icon={faCog}
						/>
						<SettingsLinkCard
							label="Buttons"
							description="Button press defaults, surface grid size, page behavior, and appearance choices."
							to="/settings/buttons"
							icon={faTh}
						/>
						<SettingsLinkCard
							label="Surfaces"
							description="Surface controller integrations and input mapping (managed in Surfaces page)."
							to="/surfaces/integrations"
							icon={faGamepad}
						/>
						<SettingsLinkCard
							label="Protocols"
							description="Network remote control protocols including TCP, UDP, HTTP, OSC, Artnet, and Satellite."
							to="/settings/protocols"
							icon={faNetworkWired}
						/>
						<SettingsLinkCard
							label="Backups"
							description="Automated, scheduled configuration backups to local or network locations."
							to="/settings/backups"
							icon={faFloppyDisk}
						/>
						<SettingsLinkCard
							label="Advanced"
							description="Admin password protection, HTTPS SSL certificates, and experimental settings."
							to="/settings/advanced"
							icon={faWarning}
						/>
					</Grid.Row>
				</div>
			</div>
		</div>
	)
}

interface SettingsLinkCardProps<TFrom extends string = string, TTo extends string | undefined = undefined> {
	label: string
	description: string
	to: ToPathOption<RegisteredRouter, TFrom, TTo>
	icon: IconProp
}

function SettingsLinkCard<const TFrom extends string = string, const TTo extends string | undefined = undefined>({
	label,
	description,
	to,
	icon,
}: SettingsLinkCardProps<TFrom, TTo>) {
	return (
		<Grid.Col sm={6} md={4}>
			<Link
				to={to}
				className="group flex flex-col h-full p-4 rounded-xl border border-border/70 bg-surface hover:bg-surface-muted/30 hover:border-primary/50 hover:shadow-sm transition-all no-underline"
			>
				<div className="flex items-center gap-3 mb-2">
					<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
						<FontAwesomeIcon icon={icon} className="text-base" />
					</span>
					<h3 className="text-sm font-bold text-body mb-0 group-hover:text-primary transition-colors">{label}</h3>
				</div>
				<p className="text-xs text-muted mb-0 leading-relaxed">{description}</p>
			</Link>
		</Grid.Col>
	)
}
