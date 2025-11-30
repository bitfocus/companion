import React, { useCallback, useContext } from 'react'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { CButton, CButtonGroup } from '@coreui/react'
import type { ClientTriggerData } from '@companion-app/shared/Model/TriggerModel.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faList } from '@fortawesome/free-solid-svg-icons'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'

interface TriggerPickerRowProps {
	id: string
	trigger: ClientTriggerData
	selectTrigger: (id: string, mode: 'replace' | 'append') => void
}
function TriggerPickerRow({ id, trigger, selectTrigger }: TriggerPickerRowProps) {
	const replaceActions = useCallback(() => selectTrigger(id, 'replace'), [id, selectTrigger])
	const appendActions = useCallback(() => selectTrigger(id, 'append'), [id, selectTrigger])

	return (
		<tr>
			<td>{trigger.name}</td>
			<td>
				<CButtonGroup>
					<CButton color="primary" title="Replace all the actions on the trigger" onClick={replaceActions}>
						Replace
					</CButton>
					<CButton color="info" title="Append to the existing actions" onClick={appendActions}>
						Append
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}
interface TriggerPickerProps {
	selectControl: (controlId: string, stepId: string, setId: ActionSetId, mode: 'append' | 'replace') => void
}
export const TriggerPicker = observer(function TriggerPicker({ selectControl }: TriggerPickerProps) {
	const { triggersList } = useContext(RootAppStoreContext)

	const selectTrigger = useCallback(
		(id: string, mode: 'append' | 'replace') => selectControl(CreateTriggerControlId(id), '', 0, mode),
		[selectControl]
	)

	return (
		<>
			<table className="table table-responsive-sm width-100">
				<thead>
					<tr>
						<th>Name</th>
						<th className="fit">&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{triggersList.triggers.size > 0 ? (
						Array.from(triggersList.triggers.entries()).map(([id, trigger]) => (
							<TriggerPickerRow key={id} id={id} trigger={trigger} selectTrigger={selectTrigger} />
						))
					) : (
						<tr>
							<td colSpan={2} className="currentlyNone">
								<NonIdealState icon={faList} text="There are currently no triggers or scheduled tasks." />
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
})
