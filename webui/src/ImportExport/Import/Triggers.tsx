import { CButton, CButtonGroup, CCallout, CFormCheck } from '@coreui/react'
import React, { useCallback, useEffect, useState, useContext } from 'react'
import { ImportRemap } from './Page.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileCircleExclamation, faFileCirclePlus } from '@fortawesome/free-solid-svg-icons'

interface ImportTriggersTabProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
}

export function ImportTriggersTab({
	snapshot,
	connectionRemap,
	setConnectionRemap,
}: ImportTriggersTabProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)

	const [selectedTriggers, setSelectedTriggers] = useState<string[]>([])

	const setConnectionRemap2 = useCallback(
		(fromId: string, toId: string) => {
			setConnectionRemap((oldRemap) => ({
				...oldRemap,
				[fromId]: toId,
			}))
		},
		[setConnectionRemap]
	)

	const selectAllTriggers = useCallback(
		() => setSelectedTriggers(Object.keys(snapshot.triggers ?? {})),
		[snapshot.triggers]
	)
	const unselectAllTriggers = useCallback(() => setSelectedTriggers([]), [])

	useEffect(() => selectAllTriggers(), [selectAllTriggers])

	const toggleTrigger = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

	const importTriggersMutation = useMutationExt(trpc.importExport.importTriggers.mutationOptions())
	const doImport = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			const doReplace = e.currentTarget.getAttribute('data-replace') === 'true'

			importTriggersMutation
				.mutateAsync({
					selectedTriggerIds: selectedTriggers,
					connectionIdRemapping: connectionRemap,
					replaceExisting: doReplace,
				})
				.then((res) => {
					notifier.current?.show(`Import successful`, `Triggers were imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setConnectionRemap(res)
					}
				})
				.catch((e) => {
					notifier.current?.show(`Import failed`, `Triggers import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[importTriggersMutation, notifier, selectedTriggers, connectionRemap, setConnectionRemap]
	)

	return (
		<>
			<h4>Triggers</h4>
			<p>Select the triggers you want to import.</p>
			<table className="table table-responsive-sm mb-3">
				<colgroup>
					<col style={{ width: '5rem' }}></col>
					<col style={{ width: 'auto' }}></col>
				</colgroup>
				<thead>
					<tr>
						<th>Import</th>
						<th>Name</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(snapshot.triggers || {}).map(([id, info]) => (
						<tr key={id}>
							<td className="compact text-center">
								<div className="form-check form-check-inline mr-1 mt-1">
									<CFormCheck data-id={id} checked={selectedTriggers.includes(id)} onChange={toggleTrigger} />
								</div>
							</td>
							<td>{info.name}</td>
						</tr>
					))}
				</tbody>
			</table>
			<CButtonGroup className="mb-3">
				<CButton
					color="info"
					onClick={selectAllTriggers}
					disabled={selectedTriggers.length === Object.keys(snapshot.triggers || {}).length}
				>
					Select all
				</CButton>
				<CButton color="info" onClick={unselectAllTriggers} disabled={selectedTriggers.length === 0}>
					Unselect all
				</CButton>
			</CButtonGroup>

			<ImportRemap snapshot={snapshot} connectionRemap={connectionRemap} setConnectionRemap={setConnectionRemap2} />

			<CCallout color="success">
				<h5>Import to Existing Triggers</h5>
				<p>This will import the selected triggers, while keeping your existing triggers.</p>
				<CButton color="success" data-replace={false} onClick={doImport} disabled={selectedTriggers.length === 0}>
					<FontAwesomeIcon icon={faFileCirclePlus} /> Add to existing triggers
				</CButton>
			</CCallout>
			<CCallout color="warning">
				<h5>Reset & Import Triggers</h5>
				<p>This will remove all existing triggers and replace them with the selected ones.</p>
				<CButton color="warning" data-replace={true} onClick={doImport} disabled={selectedTriggers.length === 0}>
					<FontAwesomeIcon icon={faFileCircleExclamation} /> Reset and import triggers
				</CButton>
			</CCallout>
		</>
	)
}
