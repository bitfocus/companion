import { Copy } from 'lucide-react'
import type { LauncherAppStatus } from '@companion-app/shared/Model/LauncherAppInfo.js'
import { Button } from '~/components/ui/button'

const STATUS_LABELS: Record<LauncherAppStatus, string> = {
	starting: 'Starting',
	running: 'Running',
	error: 'Error',
}

interface LauncherStatusProps {
	status: LauncherAppStatus
	message: string | null
	launchUrl: string | null
}

export function LauncherStatus({ status, message, launchUrl }: LauncherStatusProps): React.JSX.Element {
	const detail = message ?? (status === 'starting' ? 'Waiting for the web server…' : null)

	return (
		<div className="launcher-status" data-status={status} aria-live="polite">
			<div className="launcher-state">
				<span className="launcher-state-dot" aria-hidden="true" />
				{STATUS_LABELS[status]}
			</div>

			{launchUrl && (
				<div className="launcher-url">
					<Button variant="link" size="sm" className="font-mono" onClick={() => window.api.send('launcher-open-gui')}>
						{launchUrl}
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						title="Copy URL"
						aria-label="Copy URL"
						onClick={() => window.api.send('launcher-copy-url')}
					>
						<Copy />
					</Button>
				</div>
			)}

			{detail && <div className="launcher-status-detail">{detail}</div>}
		</div>
	)
}
