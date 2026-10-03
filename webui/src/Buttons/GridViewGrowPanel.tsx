import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button } from '~/Components/Button.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface GridViewGrowPanelProps {
	displayName: string
	/** The grid size which would hold the whole viewed surface, to grow to */
	neededBounds: UserConfigGridSize
}

/** Shown in place of the button editor for a control the viewed surface has beyond the configured grid. */
export function GridViewGrowPanel({ displayName, neededBounds }: GridViewGrowPanelProps): React.JSX.Element {
	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())

	return (
		<NonIdealState icon={faExpand} text={`This button is outside your grid`}>
			<p>
				<strong>{displayName}</strong> has a button here, but your grid does not reach it, so there is nothing to
				configure yet.
			</p>
			<Button color="primary" onClick={() => setConfigKeyMutation.mutate({ key: 'gridSize', value: neededBounds })}>
				<FontAwesomeIcon icon={faExpand} /> Grow grid to fit
			</Button>
		</NonIdealState>
	)
}
