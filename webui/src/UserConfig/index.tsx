import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import './settings.css'
import { faCog, faFloppyDisk, faGamepad, faNetworkWired, faTh, faWarning } from '@fortawesome/free-solid-svg-icons'
import { Link, type RegisteredRouter, type ToPathOption } from '@tanstack/react-router'
import { Callout } from '~/Components/Callout'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'

export function SettingsSelectPage(): React.JSX.Element {
	// Not a split: one readable-width column of cards, so this stays on the 12-column grid.
	return (
		<Grid.Row>
			<Grid.Col xxl={6} xl={8} lg={10} md={12} className="primary-panel">
				<div className="flex justify-between">
					<div>
						<h4>Settings</h4>
					</div>
				</div>
				<div className="h-fit">
					<Grid.Row>
						<SettingsLinkCard label="General" to="/settings/general" icon={faCog} />
						<SettingsLinkCard label="Buttons" to="/settings/buttons" icon={faTh} />
						<SettingsLinkCard
							label="Surfaces"
							sublabel="settings are in the Surfaces Page"
							to="/surfaces/integrations"
							icon={faGamepad}
						/>
						<SettingsLinkCard label="Protocols" to="/settings/protocols" icon={faNetworkWired} />
						<SettingsLinkCard label="Backups" to="/settings/backups" icon={faFloppyDisk} />
						<SettingsLinkCard label="Advanced" to="/settings/advanced" icon={faWarning} />
					</Grid.Row>
				</div>
			</Grid.Col>
		</Grid.Row>
	)
}

interface SettingsLinkCardProps<TFrom extends string = string, TTo extends string | undefined = undefined> {
	label: string
	sublabel?: string
	to: ToPathOption<RegisteredRouter, TFrom, TTo>
	icon: IconProp
	center?: boolean
}

function SettingsLinkCard<const TFrom extends string = string, const TTo extends string | undefined = undefined>({
	label,
	sublabel,
	to,
	icon,
	center,
}: SettingsLinkCardProps<TFrom, TTo>) {
	return (
		<Grid.Col sm={center ? { span: 6, offset: 3 } : 6} className="mb-6">
			<Link to={to} className="grid h-full settings-grid-card">
				<Callout color="info" className="h-full flex items-center justify-center">
					<NonIdealState icon={icon} style={{ padding: '5vh 1rem' }}>
						<h3>{label}</h3>
						{sublabel}
					</NonIdealState>
				</Callout>
			</Link>
		</Grid.Col>
	)
}
