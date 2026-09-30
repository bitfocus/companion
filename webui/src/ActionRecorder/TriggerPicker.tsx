import { faList } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { ClientTriggerData } from '@companion-app/shared/Model/TriggerModel.js'
import { Button } from '~/Components/Button'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Table } from '~/Components/Table.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface TriggerPickerRowProps {
	id: string
	trigger: ClientTriggerData
	saving: boolean
	selectTrigger: (id: string, mode: 'replace' | 'append') => void
}
function TriggerPickerRow({ id, trigger, selectTrigger, saving }: TriggerPickerRowProps) {
	const replaceActions = useCallback(() => selectTrigger(id, 'replace'), [id, selectTrigger])
	const appendActions = useCallback(() => selectTrigger(id, 'append'), [id, selectTrigger])

	return (
		<tr>
			<td>{trigger.name}</td>
			<td>
				<div className="recorder-destination-buttons">
					<Button
						disabled={saving}
						color="secondary"
						title="Replace all the actions on the trigger"
						onClick={replaceActions}
					>
						Replace
					</Button>
					<Button disabled={saving} color="primary" title="Append to the existing actions" onClick={appendActions}>
						Append
					</Button>
				</div>
			</td>
		</tr>
	)
}
interface TriggerPickerProps {
	saving?: boolean
	selectControl: (controlId: string, stepId: string, setId: ActionSetId, mode: 'append' | 'replace') => void
}
export const TriggerPicker = observer(function TriggerPicker({ selectControl, saving = false }: TriggerPickerProps) {
	const [search, setSearch] = useState('')
	const { triggersList } = useContext(RootAppStoreContext)

	const matchingTriggers = Array.from(triggersList.triggers.entries()).filter(([, trigger]) =>
		trigger.name.toLowerCase().includes(search.toLowerCase())
	)

	const selectTrigger = useCallback(
		(controlId: string, mode: 'append' | 'replace') => selectControl(controlId, '', 0, mode),
		[selectControl]
	)

	return (
		<>
			<div className="recorder-trigger-search">
				<TextInputFieldSimple
					id={undefined}
					value={search}
					setValue={setSearch}
					placeholder="Search triggers…"
					aria-label="Search triggers"
				/>
			</div>
			<Table className="width-100 recorder-trigger-table">
				<thead>
					<tr>
						<th>Trigger</th>
						<th className="fit">Save actions</th>
					</tr>
				</thead>
				<tbody>
					{matchingTriggers.length > 0 ? (
						matchingTriggers.map(([id, trigger]) => (
							<TriggerPickerRow key={id} id={id} trigger={trigger} selectTrigger={selectTrigger} saving={saving} />
						))
					) : (
						<tr>
							<td colSpan={2} className="currentlyNone">
								<NonIdealState
									icon={faList}
									text={
										triggersList.triggers.size
											? 'No triggers match your search.'
											: 'There are currently no triggers or scheduled tasks.'
									}
								/>
							</td>
						</tr>
					)}
				</tbody>
			</Table>
		</>
	)
})
