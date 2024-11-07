import React, { useCallback, useContext, useEffect, useState } from 'react'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { socketEmitPromise } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { CAlert } from '@coreui/react'

export function ImportModules() {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const [importBundleProgress, setImportBundleProgress] = useState<number | null>(null)
	useEffect(() => {
		setImportBundleProgress(null)

		const onProgress = (_sessionId: string, progress: number) => {
			setImportBundleProgress(progress)
			console.log('import progress', progress)
		}

		socket.on('modules:bundle-import:progress', onProgress)

		return () => {
			socket.off('modules:bundle-import:progress', onProgress)
		}
	}, [socket])

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
						const hashBuffer = await window.crypto.subtle.digest('sha-1', buffer)
						const hashText = Array.from(new Uint8Array(hashBuffer))
							.map((byte) => byte.toString(16).padStart(2, '0'))
							.join('')

						console.log('starting upload', hashText)

						const sessionId = await socketEmitPromise(socket, 'modules:bundle-import:start', [
							'test',
							buffer.length,
							hashText,
						])
						if (!sessionId) throw new Error('Failed to start upload')

						const bytesPerChunk = 1024 * 1024 * 1 // 1MB
						for (let offset = 0; offset < buffer.length; offset += bytesPerChunk) {
							console.log('uploading chunk', offset)
							const chunk = buffer.slice(offset, offset + bytesPerChunk)
							const success = await socketEmitPromise(socket, 'modules:bundle-import:chunk', [sessionId, offset, chunk])
							if (!success) throw new Error(`Failed to upload chunk ${offset}`)
						}

						console.log('uploading complete, starting load')
						const success = await socketEmitPromise(socket, 'modules:bundle-import:complete', [sessionId])
						if (!success) throw new Error(`Failed to import`)
					})
					.catch((e) => {
						console.error('failed', e)
					})

				// TODO - upload this in chunks, as the file is too large and hits the max websocket message size
				// socketEmitPromise(socket, 'modules:install-custom-module', [new Uint8Array(fr.result)], 20000)
				// 	.then((failureReason) => {
				// 		if (failureReason) {
				// 			console.error('Failed to install module', failureReason)

				// 			notifier.current?.show('Failed to install module', failureReason, 5000)
				// 		}

				// 		setImportError(null)
				// 		// if (err) {
				// 		// 	setImportError(err || 'Failed to prepare')
				// 		// } else {
				// 		// 	// const mode = config.type === 'page' ? 'import_page' : 'import_full'
				// 		// 	// modalRef.current.show(mode, config, initialRemap)
				// 		// 	// setImportInfo([config, initialRemap])
				// 		// }
				// 	})
				// 	.catch((e) => {
				// 		setImportError('Failed to load module bundle to import')
				// 		console.error('Failed to load module bundle to import:', e)
				// 	})
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
