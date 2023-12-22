import React, { useCallback, useContext } from 'react'
import { TriggersContext } from '../../util'
import { CreateTriggerControlId } from '@companion/shared/ControlId'
import { CButton, CButtonGroup } from '@coreui/react'
import type { ClientTriggerData } from '@companion/shared/Model/TriggerModel'

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
	selectControl: (controlId: string, stepId: string | null, setId: string | null, mode: 'append' | 'replace') => void
}
export function TriggerPicker({ selectControl }: TriggerPickerProps) {
	const triggersList = useContext(TriggersContext)

	const selectTrigger = useCallback(
		(id: string, mode: 'append' | 'replace') => selectControl(CreateTriggerControlId(id), null, null, mode),
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
					{triggersList && Object.keys(triggersList).length > 0 ? (
						Object.entries(triggersList).map(
							([id, item]) => item && <TriggerPickerRow key={id} id={id} trigger={item} selectTrigger={selectTrigger} />
						)
					) : (
						<tr>
							<td colSpan={2} className="currentlyNone">
								There currently are no triggers or scheduled tasks.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
}
