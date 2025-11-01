import React, { useCallback, useContext, useRef, useState } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { CAlert, CButton, CCallout } from '@coreui/react'
import { ResetWizardModal, type ResetWizardModalRef } from './Reset.js'
import { ExportWizardModal, type ExportWizardModalRef } from './Export.js'
import { ImportWizard } from './Import/index.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { observer } from 'mobx-react-lite'
import CryptoJS from 'crypto-js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { base64EncodeUint8Array } from '~/Resources/util.js'

const NOTIFICATION_ID_IMPORT = 'import_config_file'

export const ImportExportPage = observer(function ImportExport() {
	const { notifier, connections } = useContext(RootAppStoreContext)

	const [loadError, setLoadError] = useState<string | null>(null)

	const resetRef = useRef<ResetWizardModalRef>(null)
	const exportRef = useRef<ExportWizardModalRef>(null)
	const doReset = useCallback(() => resetRef.current?.show(), [])
	const doExport = useCallback(() => exportRef.current?.show(), [])

	const abortImportMutation = useMutationExt(trpc.importExport.abort.mutationOptions())

	const [importInfo, setImportInfo] = useState<[ClientImportObject, Record<string, string | undefined>] | null>(null)
	const clearImport = useCallback(() => {
		setImportInfo(null)

		abortImportMutation.mutateAsync().catch((e) => {
			console.error('Failed to abort import', e)
		})
	}, [abortImportMutation])

	const fileApiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const startPrepareImportMutation = useMutationExt(trpc.importExport.prepareImport.start.mutationOptions())
	const cancelPrepareImportMutation = useMutationExt(trpc.importExport.prepareImport.cancel.mutationOptions())
	const uploadPrepareImportChunkMutation = useMutationExt(trpc.importExport.prepareImport.uploadChunk.mutationOptions())
	const completePrepareImportMutation = useMutationExt(trpc.importExport.prepareImport.complete.mutationOptions())

	const loadSnapshot = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setLoadError('Unable to read config file')
				return
			}

			setLoadError(null)
			notifier.show('Importing config...', 'This may take a while', null, NOTIFICATION_ID_IMPORT)
			console.log(`start import of ${newFile.size} bytes`)

			const hasher = CryptoJS.algo.SHA1.create()

			Promise.resolve()
				.then(async () => {
					const sessionId = await startPrepareImportMutation.mutateAsync({
						name: newFile.name,
						size: newFile.size,
					})
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

										const success = await uploadPrepareImportChunkMutation.mutateAsync({
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

										const [err, config] = await completePrepareImportMutation.mutateAsync({
											sessionId,
											expectedChecksum: hashText,
										})

										if (err || !config) {
											setLoadError(err || 'Failed to prepare')
										} else {
											const initialRemap: Record<string, string | undefined> = {}

											// Figure out some initial mappings. Look for matching type and hopefully label
											for (const [id, obj] of Object.entries(config.instances ?? {})) {
												if (!obj) continue

												const candidateIds = []
												let matchingLabelId = ''

												for (const [otherId, otherObj] of connections.connections.entries()) {
													if (otherObj.moduleId === obj.instance_type) {
														candidateIds.push(otherId)
														if (otherObj.label === obj.label) {
															matchingLabelId = otherId
														}
													}
												}

												if (matchingLabelId) {
													initialRemap[id] = matchingLabelId
												} else {
													initialRemap[id] = candidateIds[0] || ''
												}
											}

											setLoadError(null)
											notifier.close(NOTIFICATION_ID_IMPORT)
											// const mode = config.type === 'page' ? 'import_page' : 'import_full'
											// modalRef.current.show(mode, config, initialRemap)
											setImportInfo([config, initialRemap])
										}
									},
								},
								{
									size: () => 1024 * 1024 * 1, // 1MB chunks
								}
							)
						)
						.catch((e) => {
							cancelPrepareImportMutation.mutateAsync({ sessionId }).catch((cancelErr) => {
								console.error('Failed to cancel import session', cancelErr)
							})
							throw e
						})
				})
				.catch((e) => {
					console.error('failed', e)

					notifier.show('Importing config...', 'Failed!', 5000, NOTIFICATION_ID_IMPORT)
				})
		},
		[
			startPrepareImportMutation,
			uploadPrepareImportChunkMutation,
			cancelPrepareImportMutation,
			completePrepareImportMutation,
			notifier,
			connections,
		]
	)

	if (importInfo) {
		return <ImportWizard importInfo={importInfo} clearImport={clearImport} />
	}

	// As of October 2025, this is only available on iOS Safari and iPadOS Safari
	const isMobileSafari = 'ongesturechange' in window

	return (
		<div>
			<ResetWizardModal ref={resetRef} />
			<ExportWizardModal ref={exportRef} />

			<h4>Import / Export Configuration</h4>
			<p>On this page, you can import, export, and reset all settings stored in your Companion installation.</p>

			<CCallout color="success">
				<h5>Export</h5>
				<p>Download a file containing all connections and button pages.</p>
				<CButton color="success" onClick={doExport}>
					<FontAwesomeIcon icon={faDownload} style={{ marginRight: 7, marginLeft: -2 }} />
					Export configuration
				</CButton>
			</CCallout>

			<CCallout color="warning">
				<h5>Import</h5>
				{!fileApiIsSupported ? (
					<>
						<CAlert color="warning">File uploading is not supported in your browser</CAlert>
					</>
				) : (
					<>
						<p>
							Use the button below to browse your computer for a <b>.companionconfig</b> file containing a configuration
							set.
						</p>

						<div>
							{loadError ? <CAlert color="warning">{loadError}</CAlert> : ''}

							<label className="btn btn-warning btn-file">
								<FontAwesomeIcon icon={faFileImport} style={{ marginRight: 8, marginLeft: -3 }} />
								Import configuration
								<input
									type="file"
									onChange={loadSnapshot}
									style={{ display: 'none' }}
									accept={isMobileSafari ? undefined : '.companionconfig,.yaml'} // Mobile safari doesn't support custom file extensions https://github.com/bitfocus/companion/issues/3676
								/>
							</label>
						</div>
					</>
				)}
			</CCallout>

			<CCallout color="danger">
				<h5>Reset</h5>
				<p>This will clear all connections, triggers and/or buttons.</p>
				<div>
					<CButton color="danger" style={{ backgroundColor: 'rgba(180,0,0,1)' }} onClick={doReset}>
						<FontAwesomeIcon icon={faTrashAlt} style={{ marginRight: 7, marginLeft: -1 }} />
						Reset configuration
					</CButton>
				</div>
			</CCallout>
		</div>
	)
})
