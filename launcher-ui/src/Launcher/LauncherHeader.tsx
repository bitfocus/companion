import { Settings } from 'lucide-react'
import { LogoMark } from '~/components/LogoMark'
import { Button } from '~/components/ui/button'

export function LauncherHeader({ version }: { version: string | null }): React.JSX.Element {
	return (
		<div className="launcher-header">
			<LogoMark />
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
