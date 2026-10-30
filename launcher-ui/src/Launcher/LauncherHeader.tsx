import { Settings } from 'lucide-react'
import { Button } from '~/components/ui/button'
import logoUrl from '../../../launcher/assets/icon.png'

export function LauncherHeader({ version }: { version: string | null }): React.JSX.Element {
	return (
		<div className="launcher-header">
			<img className="launcher-logo" src={logoUrl} alt="Companion logo" />
			<div className="launcher-ident">
				<span className="launcher-wordmark">Companion</span>
				{version && <span className="launcher-version">v{version}</span>}
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="launcher-settings-button"
				title="Advanced settings"
				aria-label="Advanced settings"
				onClick={() => window.api.send('launcher-advanced-settings')}
			>
				<Settings />
			</Button>
		</div>
	)
}
