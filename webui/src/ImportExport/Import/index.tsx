import { CButton } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ImportPageWizard } from './Page.js'
import { ImportFullWizard } from './Full.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

interface ImportWizardProps {
	importInfo: [ClientImportObject, Record<string, string | undefined>]
	clearImport: () => void
}

export function ImportWizard({ importInfo, clearImport }: ImportWizardProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [snapshot, connectionRemap0] = importInfo

	const [connectionRemap, setConnectionRemap] = useState(connectionRemap0)
	useEffect(() => {
		setConnectionRemap(connectionRemap0)
	}, [connectionRemap0])

	const doSinglePageImport = useCallback(
		(fromPage: number, toPage: number, connectionRemap: Record<string, string | undefined>) => {
			socket
				.emitPromise('loadsave:import-page', [toPage, fromPage, connectionRemap])
				.then((_res) => {
					notifier.current?.show(`Import successful`, `Page was imported successfully`, 10000)
					clearImport()
					// console.log('remap response', res)
					// if (res) {
					// 	setConnectionRemap(res)
					// }
				})
				.catch((e) => {
					notifier.current?.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[socket, clearImport, notifier]
	)

	return (
		<>
			<h4>
				Import Configuration
				<CButton color="danger" size="sm" onClick={clearImport}>
					Cancel
				</CButton>
			</h4>

			{snapshot.type === 'page' ? (
				<ImportPageWizard
					snapshot={snapshot}
					connectionRemap={connectionRemap}
					setConnectionRemap={setConnectionRemap}
					doImport={doSinglePageImport}
				/>
			) : (
				<ImportFullWizard
					snapshot={snapshot}
					connectionRemap={connectionRemap}
					setConnectionRemap={setConnectionRemap}
				/>
			)}
		</>
	)
}
