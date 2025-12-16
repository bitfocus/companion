import { CButton } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ImportPageWizard } from './Page.js'
import { ImportFullWizard } from './Full.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface ImportWizardProps {
	importInfo: [ClientImportObject, Record<string, string | undefined>]
	clearImport: () => void
}

export function ImportWizard({ importInfo, clearImport }: ImportWizardProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)

	const [snapshot, connectionRemap0] = importInfo

	const [connectionRemap, setConnectionRemap] = useState(connectionRemap0)
	useEffect(() => {
		setConnectionRemap(connectionRemap0)
	}, [connectionRemap0])

	const importSinglePageMutation = useMutationExt(trpc.importExport.importSinglePage.mutationOptions())

	const doSinglePageImport = useCallback(
		(fromPage: number, toPage: number, connectionRemap: Record<string, string | undefined>) => {
			importSinglePageMutation
				.mutateAsync({
					sourcePage: fromPage,
					targetPage: toPage,
					connectionIdRemapping: connectionRemap,
				})
				.then((_res) => {
					notifier.show(`Import successful`, `Page was imported successfully`, 10000)
					clearImport()
					// console.log('remap response', res)
					// if (res) {
					// 	setConnectionRemap(res)
					// }
				})
				.catch((e) => {
					notifier.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[importSinglePageMutation, clearImport, notifier]
	)

	return snapshot.type === 'page' ? (
		<div className="import-wizard single-page px-1">
			<h4>
				Import Single Page
				<CButton color="danger" size="sm" onClick={clearImport}>
					Cancel
				</CButton>
			</h4>

			<ImportPageWizard
				snapshot={snapshot}
				connectionRemap={connectionRemap}
				setConnectionRemap={setConnectionRemap}
				doImport={doSinglePageImport}
			/>
		</div>
	) : (
		<div className="import-wizard import-full">
			<h4>
				Import Configuration
				<CButton color="danger" size="sm" onClick={clearImport}>
					Cancel
				</CButton>
			</h4>
			<ImportFullWizard snapshot={snapshot} connectionRemap={connectionRemap} setConnectionRemap={setConnectionRemap} />
		</div>
	)
}
