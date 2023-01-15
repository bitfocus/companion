import { CButton } from '@coreui/react'
import React, { useCallback, useContext, useState } from 'react'
import { NotifierContext, SocketContext, socketEmitPromise } from '../../util'
import { ImportPageWizard } from './Page'
import { ImportFullWizard } from './Full'

export function ImportWizard({ importInfo, clearImport }) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const [snapshot, instanceRemap0] = importInfo

	const [instanceRemap, setInstanceRemap] = useState(instanceRemap0)

	const doSinglePageImport = useCallback(
		(_fromPage, toPage, instanceRemap) => {
			socketEmitPromise(socket, 'loadsave:import-page', [toPage, _fromPage, instanceRemap])
				.then((res) => {
					notifier.current.show(`Import successful`, `Page was imported successfully`, 10000)
					clearImport()
					// console.log('remap response', res)
					// if (res) {
					// 	setInstanceRemap(res)
					// }
				})
				.catch((e) => {
					notifier.current.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
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
					instanceRemap={instanceRemap}
					setInstanceRemap={setInstanceRemap}
					doImport={doSinglePageImport}
				/>
			) : (
				<ImportFullWizard snapshot={snapshot} instanceRemap={instanceRemap} setInstanceRemap={setInstanceRemap} />
			)}
		</>
	)
}
