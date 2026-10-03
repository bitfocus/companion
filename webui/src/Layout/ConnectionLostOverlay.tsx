import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PuffLoader } from 'react-spinners'
import { Button } from '~/Components/Button.js'
import { PRIMARY_COLOR } from '~/Resources/Constants.js'
import './ConnectionLostOverlay.css'

interface FullscreenOverlayProps {
	titleId: string
	title: string
	icon: React.ReactNode
	iconClassName: string
	widthClassName: string
	children: React.ReactNode
}

function FullscreenOverlay({
	titleId,
	title,
	icon,
	iconClassName,
	widthClassName,
	children,
}: FullscreenOverlayProps): React.JSX.Element {
	return (
		<div
			className="fullscreen-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby={titleId}
		>
			<div
				className={`bg-surface text-body border border-border/80 rounded-2xl shadow-2xl p-6 sm:p-8 w-full text-center flex flex-col items-center ${widthClassName}`}
			>
				<div className={`rounded-full flex items-center justify-center mb-4 shadow-inner ${iconClassName}`}>{icon}</div>

				<h3 id={titleId} className="text-xl font-bold text-body mb-2">
					{title}
				</h3>

				{children}
			</div>
		</div>
	)
}

/** The pulsing "still working on it" pill shown at the bottom of both overlays. */
function OverlayStatusPill({ dotClassName, label }: { dotClassName: string; label: string }): React.JSX.Element {
	return (
		<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border/70 text-xs text-muted font-medium shadow-xs">
			<span className={`w-2 h-2 rounded-full animate-pulse ${dotClassName}`} />
			<span>{label}</span>
		</div>
	)
}

const TROUBLESHOOTING_STEPS = [
	'Check that the Companion application is still running on the host machine.',
	'If accessing over a local network, check your Wi-Fi or Ethernet connection.',
	'Verify firewall and port settings if accessing Companion remotely.',
]

export function ConnectionLostOverlay(): React.JSX.Element {
	const handleReload = () => {
		window.location.reload()
	}

	return (
		<FullscreenOverlay
			titleId="connection-lost-title"
			title="Connection Lost"
			widthClassName="max-w-lg"
			iconClassName="w-14 h-14 bg-danger/10 text-danger text-2xl border border-danger/20"
			icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
		>
			<p className="text-sm text-muted mb-5 leading-relaxed">
				We have lost connection to the Companion server. We will continue trying to reconnect in the background.
			</p>

			<div className="w-full bg-surface-muted/60 border border-border/70 rounded-xl p-4 mb-5 text-start text-xs space-y-2 text-body">
				<div className="font-semibold text-muted text-2xs uppercase tracking-wider mb-2">Troubleshooting Steps</div>
				{TROUBLESHOOTING_STEPS.map((step) => (
					<div key={step} className="flex items-start gap-2">
						<span className="text-danger font-bold leading-tight">•</span>
						<span>{step}</span>
					</div>
				))}
			</div>

			<div className="mb-5">
				<OverlayStatusPill dotClassName="bg-amber-500" label="Reconnecting automatically…" />
			</div>

			<div className="flex items-center justify-center gap-3 w-full">
				<Button color="primary" onClick={handleReload} className="w-full">
					<FontAwesomeIcon icon={faRotateRight} className="me-2" />
					Reload Page
				</Button>
			</div>
		</FullscreenOverlay>
	)
}

export function ConfigImportingOverlay(): React.JSX.Element {
	return (
		<FullscreenOverlay
			titleId="config-importing-title"
			title="Applying Configuration"
			widthClassName="max-w-md"
			iconClassName="w-16 h-16 bg-primary/10 text-primary border border-primary/20"
			icon={<PuffLoader loading={true} size={40} color={PRIMARY_COLOR} />}
		>
			<p className="text-sm text-muted mb-5 leading-relaxed">
				Please stand by while the configuration is being updated. The application will refresh automatically when
				complete.
			</p>

			<OverlayStatusPill dotClassName="bg-info" label="Updating system…" />
		</FullscreenOverlay>
	)
}
