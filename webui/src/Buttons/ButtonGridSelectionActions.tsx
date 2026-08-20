import { faArrowsAlt, faArrowsLeftRight, faCopy, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import { Button } from '~/Components/Button.js'
import { useButtonGridView, useGridSelectedLocations } from './ButtonGridViewContext.js'
import type { GridToolId } from './GridTools/index.js'

/**
 * What can be done with the current selection. Shared by the bar above the grid and the selection
 * panel, so the two can never disagree about what is on offer.
 */
export function ButtonGridSelectionActions(): React.JSX.Element {
	const { store, actions } = useButtonGridView()
	const selectedLocations = useGridSelectedLocations()

	const startTool = useCallback((id: GridToolId) => store.setTool(id, actions), [store, actions])
	const clearSelection = useCallback(() => store.clearSelection(), [store])
	const deleteSelection = useCallback(() => actions.clearButtons([...selectedLocations]), [actions, selectedLocations])

	return (
		<>
			<Button color="light" onClick={() => startTool('copy')} title="Copy the selected buttons somewhere else">
				<FontAwesomeIcon icon={faCopy} /> Copy
			</Button>
			<Button color="light" onClick={() => startTool('move')} title="Move the selected buttons somewhere else">
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
}
