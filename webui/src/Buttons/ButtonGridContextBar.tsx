import { faArrowsAlt, faArrowsLeftRight, faCopy, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import { Button } from '~/Components/Button.js'
import {
	useButtonGridView,
	useGridHint,
	useGridSelectedLocations,
	useGridSelectionCount,
	useGridSelectionPageNumber,
} from './ButtonGridViewContext.js'
import type { GridToolId } from './GridTools/index.js'

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
	const selectedLocations = useGridSelectedLocations()

	const cancel = useCallback(() => store.goBack(actions), [store, actions])
	const clearSelection = useCallback(() => store.clearSelection(), [store])
	const startTool = useCallback((id: GridToolId) => store.setTool(id, actions), [store, actions])
	const deleteSelection = useCallback(() => actions.clearButtons([...selectedLocations]), [actions, selectedLocations])

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
						<Button color="light" onClick={() => startTool('copy')} title="Copy the selected buttons">
							<FontAwesomeIcon icon={faCopy} /> Copy
						</Button>
						<Button color="light" onClick={() => startTool('move')} title="Move the selected buttons">
							<FontAwesomeIcon icon={faArrowsAlt} /> Move
						</Button>
						<Button color="light" onClick={() => startTool('swap')} title="Swap the selected buttons with others">
							<FontAwesomeIcon icon={faArrowsLeftRight} /> Swap
						</Button>
						<Button color="danger" onClick={deleteSelection} title="Clear the selected buttons">
							<FontAwesomeIcon icon={faTrash} /> Delete
						</Button>
						<Button color="light" onClick={clearSelection} title="Clear the selection">
							<FontAwesomeIcon icon={faXmark} /> Deselect
						</Button>
					</>
				)
			)}
		</div>
	)
}
