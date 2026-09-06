import { EyeIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import './GridViewAs.css'
import classNames from 'classnames'
import { Button } from '~/Components/Button.js'
import type { GridViewAsResolution } from './GridViewAs.js'

interface GridViewAsBannerProps {
	resolution: GridViewAsResolution
	/** Opens the popover which chooses what to view as, for the states which need one choosing */
	onConfigure: () => void
	onExit: () => void
}

/**
 * Says, the whole time it is on, that the grid is not showing all of itself.
 *
 * Somebody who comes back to a cropped grid with no memory of asking for one has to be able to get
 * out of it in a click, without first having to work out what happened to their buttons - so this is
 * a banner rather than a mark on a toolbar, and it carries its own way out.
 *
 * When the view is on but has nothing to show, the banner also carries the way *in*: the state it is
 * reporting is one the user has to change something to leave, and the control which changes it is a
 * popover they would otherwise have to go looking for.
 */
export function GridViewAsBanner({ resolution, onConfigure, onExit }: GridViewAsBannerProps): React.ReactNode {
	if (resolution.status === 'off') return null

	const isViewing = resolution.status === 'ready'

	return (
		<div
			className={classNames(
				'grid-view-as-banner',
				isViewing ? 'grid-view-as-banner-viewing' : 'grid-view-as-banner-warning'
			)}
			role="status"
		>
			{isViewing ? <EyeIcon size={16} /> : <TriangleAlertIcon size={16} />}

			<div className="grid-view-as-banner-text">
				<GridViewAsBannerMessage resolution={resolution} />
			</div>

			{!isViewing && (
				<Button color="light" size="sm" onClick={onConfigure}>
					Choose a surface
				</Button>
			)}

			<Button
				size="sm"
				onClick={onExit}
				title="Show the whole grid again"
				aria-label="Show the whole grid again"
				className="grid-view-as-banner-exit"
			>
				<XIcon size={14} />
			</Button>
		</div>
	)
}

function GridViewAsBannerMessage({ resolution }: { resolution: GridViewAsResolution }): React.ReactNode {
	switch (resolution.status) {
		case 'off':
			return null

		case 'noSelection':
			return <>No surface has been chosen to view the grid as yet.</>

		case 'unknownSurface':
			return <>The surface this grid was being viewed as is no longer known, so the whole grid is shown.</>

		case 'offGrid':
			return (
				<>
					<strong>{resolution.displayName}</strong> sits outside the grid, so there is nothing of it to show. Move it,
					or make the grid large enough to hold it.
				</>
			)

		case 'noLayout':
			return (
				<>
					The layout of <strong>{resolution.displayName}</strong> is not known, so the whole grid is shown. Connect it
					once and Companion will remember how it is laid out.
				</>
			)

		case 'ready':
			return (
				<>
					Viewing the grid as <strong>{resolution.displayName}</strong> &mdash; only the buttons it shows are here,
					drawn the shape it draws them.
					{resolution.view.hasMixedAspectRatios && ' Controls of a different shape are drawn at their own.'}
					{resolution.partlyOffGrid && ' Part of it is beyond the grid, and is not shown.'}
				</>
			)
	}
}
