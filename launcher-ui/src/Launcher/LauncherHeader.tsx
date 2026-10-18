import { Settings } from 'lucide-react'
import { Button } from '~/components/ui/button'
// The same logo file as the web UI's sidebar
import logoUrl from '../../../webui/public/img/logo-glass.png'

export function LauncherHeader({ version }: { version: string | null }): React.JSX.Element {
	return (
		<div className="launcher-header">
			<span className="launcher-logo-mark">
				<img src={logoUrl} alt="Companion logo" />
			</span>
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
