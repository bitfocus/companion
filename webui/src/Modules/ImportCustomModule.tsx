import React, { useCallback, useContext, useState } from 'react'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { socketEmitPromise } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { CAlert } from '@coreui/react'

export function ImportCustomModule() {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [importError, setImportError] = useState<string | null>(null)

	const loadModuleFile = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setImportError('Unable to read config file')
				return
			}

			var fr = new FileReader()
			fr.onload = () => {
				if (!fr.result) {
					setImportError('Failed to load file contents')
					return
				}

				if (typeof fr.result === 'string') {
					setImportError('Failed to load file contents in correct format')
					return
				}

				setImportError(null)
				socketEmitPromise(socket, 'modules:install-custom-module', [new Uint8Array(fr.result)], 20000)
					.then((failureReason) => {
						if (failureReason) {
							console.error('Failed to install module', failureReason)

							notifier.current?.show('Failed to install module', failureReason, 5000)
						}

						setImportError(null)
						// if (err) {
						// 	setImportError(err || 'Failed to prepare')
						// } else {
						// 	// const mode = config.type === 'page' ? 'import_page' : 'import_full'
						// 	// modalRef.current.show(mode, config, initialRemap)
						// 	// setImportInfo([config, initialRemap])
						// }
					})
					.catch((e) => {
						setImportError('Failed to load config to import')
						console.error('Failed to load config to import:', e)
					})
			}
			fr.readAsArrayBuffer(newFile)
		},
		[socket]
	)

	return (
		<div>
			<label className="btn btn-warning btn-file">
				<FontAwesomeIcon icon={faFileImport} style={{ marginRight: 8, marginLeft: -3 }} />
				Import module package
				<input type="file" onChange={loadModuleFile} style={{ display: 'none' }} accept=".tgz" />
			</label>

			{importError ? (
				<CAlert color="warning" dismissible onClose={() => setImportError(null)}>
					{importError}
				</CAlert>
			) : (
				''
			)}
		</div>
	)
}
