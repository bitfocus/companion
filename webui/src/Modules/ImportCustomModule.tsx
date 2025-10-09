import React, { useCallback, useContext, useEffect, useState } from 'react'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CAlert } from '@coreui/react'
import CryptoJS from 'crypto-js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useSubscription } from '@trpc/tanstack-react-query'
import { base64EncodeUint8Array } from '~/Resources/util'

const NOTIFICATION_ID_IMPORT = 'import_module_bundle'

export function ImportModules(): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)

	const [importSessionId, setImportSessionId] = useState<string | null>(null)

	useSubscription(
		trpc.instances.modulesManager.bundleUpload.watchProgress.subscriptionOptions(
			{
				sessionId: importSessionId ?? '',
			},
			{
				enabled: !!importSessionId,
				onData: (data) => {
					if (data === null) {
						notifier.current?.close(NOTIFICATION_ID_IMPORT)
					} else {
						const progress = data as number | null
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
					}
				},
			}
		)
	)
	useEffect(() => {
		if (!importSessionId) {
			notifier.current?.close(NOTIFICATION_ID_IMPORT)
		}
	}, [notifier, importSessionId])

	const [importError, setImportError] = useState<string | null>(null)

	const installTarMutation = useMutationExt(trpc.instances.modulesManager.installModuleTar.mutationOptions())
	const loadModuleFile = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setImportError('Unable to read config file')
				return
			}

			Promise.resolve()
				.then(async () => {
					const buffer = await newFile.arrayBuffer()

					setImportError(null)
					await installTarMutation // TODO: 20s timeout?
						.mutateAsync({
							tarBuffer: base64EncodeUint8Array(new Uint8Array(buffer)),
						})
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
				})
				.catch((e) => {
					setImportError('Failed to load module package to import')
					console.error('Failed to load module package to import:', e)
				})
		},
		[installTarMutation, notifier]
	)

	const startBundleImportMutation = useMutationExt(trpc.instances.modulesManager.bundleUpload.start.mutationOptions())
	const cancelBundleImportMutation = useMutationExt(trpc.instances.modulesManager.bundleUpload.cancel.mutationOptions())
	const uploadBundleChunkMutation = useMutationExt(
		trpc.instances.modulesManager.bundleUpload.uploadChunk.mutationOptions()
	)
	const completeBundleImportMutation = useMutationExt(
		trpc.instances.modulesManager.bundleUpload.complete.mutationOptions()
	)

	const loadModuleBundle = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			setImportSessionId(null)

			if (newFile === undefined || newFile.type === undefined) {
				setImportError('Unable to read module bundle')
				return
			}

			setImportError(null)
			notifier.current?.show('Importing module bundle...', 'This may take a while', null, NOTIFICATION_ID_IMPORT)
			console.log(`start import of ${newFile.size} bytes`)

			const hasher = CryptoJS.algo.SHA1.create()

			Promise.resolve()
				.then(async () => {
					const sessionId = await startBundleImportMutation.mutateAsync({ name: newFile.name, size: newFile.size })
					if (!sessionId) throw new Error('Failed to start upload')

					setImportSessionId(sessionId)

					let offset = 0
					await newFile
						.stream()
						.pipeTo(
							new WritableStream(
								{
									async write(chunk) {
										const chunkOffset = offset
										offset += chunk.length

										const success = await uploadBundleChunkMutation.mutateAsync({
											sessionId,
											offset: chunkOffset,
											data: base64EncodeUint8Array(chunk),
										})
										if (!success) throw new Error(`Failed to upload chunk ${chunkOffset}`)

										hasher.update(CryptoJS.lib.WordArray.create(chunk))
									},
									async close() {
										console.log('uploading complete, starting load')
										const hashText = hasher.finalize().toString(CryptoJS.enc.Hex)

										const success = await completeBundleImportMutation.mutateAsync({
											sessionId,
											expectedChecksum: hashText,
										})
										if (!success) throw new Error(`Failed to import`)

										setImportSessionId(null)
									},
								},
								{
									size: () => 1024 * 1024 * 1, // 1MB chunks
								}
							)
						)
						.catch((e) => {
							setImportSessionId(null)

							cancelBundleImportMutation.mutateAsync({ sessionId }).catch((cancelErr) => {
								console.error('Failed to cancel import session', cancelErr)
							})
							throw e
						})
				})
				.catch((e) => {
					console.error('failed', e)

					notifier.current?.close(NOTIFICATION_ID_IMPORT)
					notifier.current?.show('Importing module bundle...', 'Failed!', 5000)
				})
		},
		[
			startBundleImportMutation,
			cancelBundleImportMutation,
			uploadBundleChunkMutation,
			completeBundleImportMutation,
			notifier,
		]
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
