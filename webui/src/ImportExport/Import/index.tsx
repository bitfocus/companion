import { faArrowLeft, faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useEffect, useState } from 'react'
import './import-wizard.css'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { Button } from '~/Components/Button'
import { PageHeader } from '~/Layout/PageHeader.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImportFullWizard } from './Full.js'
import { ImportPageWizard } from './Page.js'

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
				})
				.catch((e) => {
					notifier.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[importSinglePageMutation, clearImport, notifier]
	)

	const isSinglePage = snapshot.type === 'page'
	const title = isSinglePage ? 'Import Single Page' : 'Import Configuration'

	return (
		<div className="page-shell">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<PageHeader icon={faFileImport} title={title} />
				<Button color="secondary" size="sm" onClick={clearImport} className="flex items-center gap-1.5">
					<FontAwesomeIcon icon={faArrowLeft} />
					Cancel Import
				</Button>
			</div>

			<div className="page-scroll">
				{isSinglePage ? (
					<div className="import-wizard single-page p-1">
						<ImportPageWizard
							snapshot={snapshot}
							connectionRemap={connectionRemap}
							setConnectionRemap={setConnectionRemap}
							doImport={doSinglePageImport}
						/>
					</div>
				) : (
					<div className="import-wizard import-full">
						<ImportFullWizard
							snapshot={snapshot}
							connectionRemap={connectionRemap}
							setConnectionRemap={setConnectionRemap}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
