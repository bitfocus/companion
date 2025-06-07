import React, { useCallback, useContext, useEffect, useState } from 'react'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CAlert } from '@coreui/react'
import { generateSha1Hash } from '~/util.js'

const NOTIFICATION_ID_IMPORT = 'import_module_bundle'

export function ImportModules() {
	const { socket, notifier } = useContext(RootAppStoreContext)

	// const [importBundleProgress, setImportBundleProgress] = useState<number | null>(null)
	useEffect(() => {
		// setImportBundleProgress(null)
		notifier.current?.close(NOTIFICATION_ID_IMPORT)

		const unsubProgress = socket.on('modules:bundle-import:progress', (_sessionId, progress) => {
			// setImportBundleProgress(progress)
			console.log('import progress', progress)

			if (progress === null) {
				notifier.current?.show('Importing module bundle...', 'Completed', 5000, NOTIFICATION_ID_IMPORT)
			} else {
				notifier.current?.show(
					'Importing module bundle...',
					`${Math.round(progress * 100)}% complete`,
					null,
					NOTIFICATION_ID_IMPORT
				)
			}
		})

		return () => {
			unsubProgress()
		}
	}, [socket, notifier])

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
					setImportError('Failed to load file')
					return
				}

				if (typeof fr.result === 'string') {
					setImportError('Failed to load file contents in correct format')
					return
				}

				setImportError(null)
				socket
					.emitPromise('modules:install-module-tar', [new Uint8Array(fr.result)], 20000)
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
						setImportError('Failed to load module package to import')
						console.error('Failed to load module package to import:', e)
					})
			}
			fr.readAsArrayBuffer(newFile)
		},
		[socket]
	)

	const loadModuleBundle = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setImportError('Unable to read module bundle')
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
				const buffer = new Uint8Array(fr.result)
				console.log('start import...', buffer)

				Promise.resolve()
					.then(async () => {
						notifier.current?.show('Importing module bundle...', 'This may take a while', null, NOTIFICATION_ID_IMPORT)

						const hashText = await generateSha1Hash(buffer)

						console.log('starting upload', hashText)

						const sessionId = await socket.emitPromise('modules:bundle-import:start', ['test', buffer.length, hashText])
						if (!sessionId) throw new Error('Failed to start upload')

						const bytesPerChunk = 1024 * 1024 * 1 // 1MB
						for (let offset = 0; offset < buffer.length; offset += bytesPerChunk) {
							console.log('uploading chunk', offset)
							const chunk = buffer.slice(offset, offset + bytesPerChunk)
							const success = await socket.emitPromise('modules:bundle-import:chunk', [sessionId, offset, chunk])
							if (!success) throw new Error(`Failed to upload chunk ${offset}`)
						}

						console.log('uploading complete, starting load')
						const success = await socket.emitPromise('modules:bundle-import:complete', [sessionId])
						if (!success) throw new Error(`Failed to import`)
					})
					.catch((e) => {
						console.error('failed', e)

						notifier.current?.show('Importing module bundle...', 'Failed!', 5000, NOTIFICATION_ID_IMPORT)
					})
			}
			fr.readAsArrayBuffer(newFile)
		},
		[socket, notifier]
	)

	return (
		<div className="import-module">
			<label className="btn btn-warning btn-file">
				<FontAwesomeIcon icon={faFileImport} style={{ marginRight: 8, marginLeft: -3 }} />
				Import module package
				<input type="file" onChange={loadModuleFile} style={{ display: 'none' }} accept=".tgz" />
			</label>
			&nbsp;
			<label className="btn btn-info btn-file">
				<FontAwesomeIcon icon={faFileImport} style={{ marginRight: 8, marginLeft: -3 }} />
				Import offline module bundle
				<input type="file" onChange={loadModuleBundle} style={{ display: 'none' }} accept=".tgz,.gz" />
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
