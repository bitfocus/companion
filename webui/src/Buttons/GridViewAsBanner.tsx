import { faEye, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '~/Components/Button.js'
import { Note } from '~/Components/Note.js'
import type { GridViewAsResolution } from './GridViewAs.js'

interface GridViewAsBannerProps {
	resolution: GridViewAsResolution
	/** Opens the popover which chooses what to view as, for the states which need one choosing */
	onConfigure: () => void
	onExit: () => void
}

/**
 * Remind users, that only a subset of the grid is being shown.
 *
 * When the view is on but has nothing to show, the banner also carries the way *in*: the state it is
 * reporting is one the user has to change something to leave, and the control which changes it is a
 * popover they would otherwise have to go looking for.
 */
export function GridViewAsBanner({ resolution, onConfigure, onExit }: GridViewAsBannerProps): React.ReactNode {
	if (resolution.status === 'off') return null

	const isViewing = resolution.status === 'ready'

	return (
		<Note
			tone={isViewing ? 'neutral' : 'warning'}
			icon={isViewing ? faEye : faTriangleExclamation}
			className="mb-2"
			actions={
				<>
					{!isViewing && (
						<Button variant="outline" size="sm" onClick={onConfigure}>
							Choose a surface
						</Button>
					)}
					<Button variant="icon" size="sm" onClick={onExit} title="Show the whole grid again">
						<FontAwesomeIcon icon={faXmark} />
					</Button>
				</>
			}
		>
			<GridViewAsBannerMessage resolution={resolution} />
		</Note>
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
					Viewing the grid as <strong>{resolution.displayName}</strong> &mdash; only the buttons it has are here, laid
					out and drawn the way it lays them out and draws them. Any beyond your grid are shown but cannot be configured
					until you grow it to fit.
				</>
			)
	}
}
