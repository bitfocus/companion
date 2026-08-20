import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import { Button } from '~/Components/Button.js'
import { ButtonGridSelectionActions } from './ButtonGridSelectionActions.js'
import {
	useButtonGridView,
	useGridHint,
	useGridSelectionCount,
	useGridSelectionPageNumber,
} from './ButtonGridViewContext.js'

/**
 * The one band of chrome that comes and goes: it says what the grid is waiting for, or what is
 * selected and what can be done with it.
 *
 * It keeps its height whether or not it has anything to show, so the grid underneath never jumps.
 */
export function ButtonGridContextBar(): React.JSX.Element {
	const { store, actions } = useButtonGridView()

	const hint = useGridHint()
	const selectionCount = useGridSelectionCount()
	const selectionPageNumber = useGridSelectionPageNumber()

	const cancel = useCallback(() => store.goBack(actions), [store, actions])

	return (
		<div className="button-grid-context-bar">
			{hint ? (
				<>
					<span className="button-grid-context-bar-hint">{hint}</span>
					<Button color="danger" onClick={cancel} title="Cancel">
						<FontAwesomeIcon icon={faXmark} /> Cancel
					</Button>
				</>
			) : (
				selectionCount > 1 && (
					<>
						<span className="button-grid-context-bar-hint">
							{selectionCount} buttons selected
							{selectionPageNumber !== null && ` on page ${selectionPageNumber}`}
						</span>
						<ButtonGridSelectionActions />
					</>
				)
			)}
		</div>
	)
}
