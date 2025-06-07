import React, { useCallback, useContext, useEffect, useState } from 'react'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CAlert } from '@coreui/react'
import CryptoJS from 'crypto-js'

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

			setImportError(null)
			notifier.current?.show('Importing module bundle...', 'This may take a while', null, NOTIFICATION_ID_IMPORT)
			console.log(`start import of ${newFile.size} bytes`)

			let hasher = CryptoJS.algo.SHA1.create()

			Promise.resolve()
				.then(async () => {
					const sessionId = await socket.emitPromise('modules:bundle-import:start', [newFile.name, newFile.size])
					if (!sessionId) throw new Error('Failed to start upload')

					let offset = 0
					await newFile
						.stream()
						.pipeTo(
							new WritableStream(
								{
									async write(chunk) {
										const chunkOffset = offset
										offset += chunk.length

										const success = await socket.emitPromise('modules:bundle-import:chunk', [
											sessionId,
											chunkOffset,
											chunk,
										])
										if (!success) throw new Error(`Failed to upload chunk ${chunkOffset}`)

										hasher.update(CryptoJS.lib.WordArray.create(chunk))
									},
									async close() {
										console.log('uploading complete, starting load')
										const hashText = hasher.finalize().toString(CryptoJS.enc.Hex)

										const success = await socket.emitPromise('modules:bundle-import:complete', [sessionId, hashText])
										if (!success) throw new Error(`Failed to import`)
									},
								},
								{
									size: () => 1024 * 1024 * 1, // 1MB chunks
								}
							)
						)
						.catch((e) => {
							socket.emitPromise('modules:bundle-import:cancel', [sessionId])
							throw e
						})
				})
				.catch((e) => {
					console.error('failed', e)

					notifier.current?.show('Importing module bundle...', 'Failed!', 5000, NOTIFICATION_ID_IMPORT)
				})
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
