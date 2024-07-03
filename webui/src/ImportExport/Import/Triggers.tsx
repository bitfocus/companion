import { CButton, CButtonGroup, CFormCheck } from '@coreui/react'
import React, { ChangeEvent, useCallback, useEffect, useState, useContext } from 'react'
import { ImportRemap } from './Page.js'
import { socketEmitPromise } from '../../util.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

interface ImportTriggersTabProps {
	snapshot: ClientImportObject
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
}

export function ImportTriggersTab({ snapshot, instanceRemap, setInstanceRemap }: ImportTriggersTabProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [selectedTriggers, setSelectedTriggers] = useState<string[]>([])

	const setInstanceRemap2 = useCallback(
		(fromId: string, toId: string) => {
			setInstanceRemap((oldRemap) => ({
				...oldRemap,
				[fromId]: toId,
			}))
		},
		[setInstanceRemap]
	)

	const selectAllTriggers = useCallback(
		() => setSelectedTriggers(Object.keys(snapshot.triggers ?? {})),
		[snapshot.triggers]
	)
	const unselectAllTriggers = useCallback(() => setSelectedTriggers([]), [])

	useEffect(() => selectAllTriggers(), [selectAllTriggers])

	const toggleTrigger = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const id = e.target.getAttribute('data-id')
		const checked = e.target.checked
		if (id) {
			setSelectedTriggers((oldTriggers) => {
				if (checked) {
					return [...oldTriggers, id]
				} else {
					return oldTriggers.filter((v) => v !== id)
				}
			})
		}
	}, [])

	const doImport = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			const doReplace = e.currentTarget.getAttribute('data-replace') === 'true'

			console.log('import', selectedTriggers, doReplace, e.currentTarget.getAttribute('data-replace'))

			socketEmitPromise(socket, 'loadsave:import-triggers', [selectedTriggers, instanceRemap, doReplace])
				.then((res) => {
					notifier.current?.show(`Import successful`, `Triggers were imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setInstanceRemap(res)
					}
				})
				.catch((e) => {
					notifier.current?.show(`Import failed`, `Triggers import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[socket, notifier, selectedTriggers, instanceRemap, setInstanceRemap]
	)

	return (
		<>
			<h4>Triggers</h4>
			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>&nbsp;</th>
						<th>Name</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(snapshot.triggers || {}).map(([id, info]) => (
						<tr key={id}>
							<td className="compact">
								<div className="form-check form-check-inline mr-1">
									<CFormCheck data-id={id} checked={selectedTriggers.includes(id)} onChange={toggleTrigger} />
								</div>
							</td>
							<td>{info.name}</td>
						</tr>
					))}
				</tbody>
			</table>

			<ImportRemap snapshot={snapshot} instanceRemap={instanceRemap} setInstanceRemap={setInstanceRemap2} />

			<div>
				<CButtonGroup style={{ float: 'right' }}>
					<CButton color="info" onClick={selectAllTriggers}>
						Select all
					</CButton>
					<CButton color="info" onClick={unselectAllTriggers}>
						Unselect all
					</CButton>
				</CButtonGroup>
				<CButtonGroup>
					<CButton color="success" data-replace={true} onClick={doImport} disabled={selectedTriggers.length === 0}>
						Import (Replace existing)
					</CButton>
					<CButton color="primary" data-replace={false} onClick={doImport} disabled={selectedTriggers.length === 0}>
						Import (Append to existing)
					</CButton>
				</CButtonGroup>
			</div>
		</>
	)
}
