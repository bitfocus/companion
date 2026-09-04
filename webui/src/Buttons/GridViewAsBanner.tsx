import { EyeIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import './GridViewAs.css'
import classNames from 'classnames'
import { Button } from '~/Components/Button.js'
import type { GridViewAsResolution } from './GridViewAs.js'

interface GridViewAsBannerProps {
	resolution: GridViewAsResolution
	onExit: () => void
}

/**
 * Says, the whole time it is on, that the grid is not showing all of itself.
 *
 * Somebody who comes back to a cropped grid with no memory of asking for one has to be able to get
 * out of it in a click, without first having to work out what happened to their buttons - so this is
 * a banner rather than a mark on a toolbar, and it carries its own way out.
 */
export function GridViewAsBanner({ resolution, onExit }: GridViewAsBannerProps): React.ReactNode {
	if (resolution.status === 'off') return null

	const variant = resolution.status === 'ready' ? 'viewing' : 'warning'

	return (
		<div className={classNames('grid-view-as-banner', `grid-view-as-banner-${variant}`)} role="status">
			{variant === 'viewing' ? <EyeIcon size={16} /> : <TriangleAlertIcon size={16} />}

			<div className="grid-view-as-banner-text">
				<GridViewAsBannerMessage resolution={resolution} />
			</div>

			<Button color="light" size="sm" onClick={onExit} title="Show the whole grid again">
				<XIcon size={14} />
				&nbsp;Show whole grid
			</Button>
		</div>
	)
}

function GridViewAsBannerMessage({ resolution }: { resolution: GridViewAsResolution }): React.ReactNode {
	switch (resolution.status) {
		case 'off':
			return null

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
