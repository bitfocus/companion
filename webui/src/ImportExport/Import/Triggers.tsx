import { faFileCircleExclamation, faFileCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useEffect, useState } from 'react'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { Table } from '~/Components/Table.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImportRemap } from './Page.js'

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

	const toggleTrigger = useCallback((id: string, checked: boolean) => {
		setSelectedTriggers((oldTriggers) => {
			if (checked) {
				return [...oldTriggers, id]
			} else {
				return oldTriggers.filter((v) => v !== id)
			}
		})
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
					notifier.show(`Import successful`, `Triggers were imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setConnectionRemap(res)
					}
				})
				.catch((e) => {
					notifier.show(`Import failed`, `Triggers import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[importTriggersMutation, notifier, selectedTriggers, connectionRemap, setConnectionRemap]
	)

	return (
		<div className="space-y-4">
			<div className="surface-card">
				<div className="p-4 border-b border-border/70 bg-surface-muted/30 flex items-center justify-between flex-wrap gap-2">
					<div>
						<h5 className="text-sm font-bold text-body mb-0.5">Select Triggers</h5>
						<p className="text-xs text-muted mb-0">Choose which triggers to import from this snapshot.</p>
					</div>
					<ButtonGroup>
						<Button
							color="secondary"
							size="sm"
							onClick={selectAllTriggers}
							disabled={selectedTriggers.length === Object.keys(snapshot.triggers || {}).length}
						>
							Select All
						</Button>
						<Button color="secondary" size="sm" onClick={unselectAllTriggers} disabled={selectedTriggers.length === 0}>
							Unselect All
						</Button>
					</ButtonGroup>
				</div>

				<div className="overflow-x-auto">
					<Table className="mb-0">
						<colgroup>
							<col className="w-16" />
							<col className="w-auto" />
						</colgroup>
						<thead>
							<tr className="bg-surface-muted/50 text-xs text-muted uppercase">
								<th className="py-2.5 px-3 text-center">Import</th>
								<th className="py-2.5 px-3">Trigger Name</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/60">
							{Object.entries(snapshot.triggers || {}).map(([id, info]) => (
								<tr key={id} className="hover:bg-surface-hover/60 transition-colors">
									<td className="compact text-center py-2 px-3">
										<CheckboxInputField
											id={undefined}
											value={selectedTriggers.includes(id)}
											setValue={(value) => toggleTrigger(id, value)}
										/>
									</td>
									<td className="py-2 px-3 font-medium text-sm text-body">{info.name}</td>
								</tr>
							))}
						</tbody>
					</Table>
				</div>
			</div>

			<ImportRemap snapshot={snapshot} connectionRemap={connectionRemap} setConnectionRemap={setConnectionRemap2} />

			<div className="space-y-3 pt-2">
				<div className="rounded-xl border border-emerald-500/30 bg-surface p-4 flex flex-col justify-between gap-3 shadow-xs">
					<div>
						<h5 className="text-sm font-bold text-body mb-1">Add to Existing Triggers</h5>
						<p className="text-xs text-muted leading-relaxed mb-0">
							Imports the selected triggers alongside your current trigger list without modifying existing triggers.
						</p>
					</div>
					<div>
						<Button color="success" data-replace={false} onClick={doImport} disabled={selectedTriggers.length === 0}>
							<FontAwesomeIcon icon={faFileCirclePlus} className="me-1.5" /> Add to Existing Triggers
						</Button>
					</div>
				</div>

				<div className="rounded-xl border border-rose-500/30 bg-surface p-4 flex flex-col justify-between gap-3 shadow-xs">
					<div>
						<h5 className="text-sm font-bold text-body mb-1">Reset & Import Triggers</h5>
						<p className="text-xs text-muted leading-relaxed mb-0">
							Permanently deletes all existing triggers and replaces them entirely with the selected triggers.
						</p>
					</div>
					<div>
						<Button color="danger" data-replace={true} onClick={doImport} disabled={selectedTriggers.length === 0}>
							<FontAwesomeIcon icon={faFileCircleExclamation} className="me-1.5" /> Reset and Import Triggers
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
