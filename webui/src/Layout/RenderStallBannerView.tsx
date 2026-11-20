import { Link } from '@tanstack/react-router'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { QuarantinedRender, RenderStallStatus } from '@companion-app/shared/Model/RenderStall.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { RelativeTime } from '~/Components/RelativeTime.js'
import { useNow } from '~/Hooks/useNow.js'
import './RenderStallBanner.css'

interface RenderStallBannerViewProps {
	status: RenderStallStatus
	onRetry: (key: string) => void
	onPostponeRestart: () => void
	onRestartNow: () => void
}

/** Warns that some draws stalled the renderer, so are shown as a placeholder, and of any restart to recover */
export function RenderStallBannerView({
	status,
	onRetry,
	onPostponeRestart,
	onRestartNow,
}: RenderStallBannerViewProps): React.JSX.Element | null {
	if (status.quarantined.length === 0 && !status.restart) return null

	return (
		<StaticAlert color="danger" className="render-stall-banner">
			{status.restart && (
				<div className="render-stall-restart">
					<span>
						{status.restart.type === 'scheduled' ? (
							<>
								{status.lostThreads} render threads are stuck, so Companion will restart in{' '}
								<RestartCountdown at={status.restart.at} />.
							</>
						) : (
							`${status.lostThreads} render threads are stuck, and restarting automatically hasn't helped. Restart Companion to free them.`
						)}
					</span>
					<Button size="sm" color="danger" onClick={onRestartNow}>
						Restart now
					</Button>
					{status.restart.type === 'scheduled' && (
						<Button size="sm" color="secondary" onClick={onPostponeRestart}>
							Postpone 10 minutes
						</Button>
					)}
				</div>
			)}

			{status.quarantined.length > 0 && (
				<>
					<p className="mb-1">
						Drawing these locked up the renderer, so they are shown as a placeholder until Companion is updated. If this
						keeps happening, please report it with the text below.
					</p>
					<ul className="render-stall-list">
						{status.quarantined.map((entry) => (
							<QuarantinedRenderRow key={entry.key} entry={entry} onRetry={onRetry} />
						))}
					</ul>
				</>
			)}
		</StaticAlert>
	)
}

/** Its own component, as it re-renders every second */
function RestartCountdown({ at }: { at: number }): React.JSX.Element {
	const now = useNow(1000)
	return <>{Math.max(0, Math.ceil((at - now) / 1000))}s</>
}

function QuarantinedRenderRow({
	entry,
	onRetry,
}: {
	entry: QuarantinedRender
	onRetry: (key: string) => void
}): React.JSX.Element {
	return (
		<li>
			{entry.location ? (
				<Link to="/buttons/$page" params={{ page: String(entry.location.pageNumber) }}>
					Button {formatLocation(entry.location)}
				</Link>
			) : (
				<span>{entry.description}</span>
			)}{' '}
			<RelativeTime timestamp={entry.time} className="render-stall-time" />
			{entry.texts.length > 0 && (
				<span className="render-stall-texts">{entry.texts.map((text) => JSON.stringify(text.text)).join(', ')}</span>
			)}
			<Button size="sm" variant="outline" color="danger" onClick={() => onRetry(entry.key)}>
				Try again
			</Button>
		</li>
	)
}
