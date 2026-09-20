import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import CryptoJS from 'crypto-js'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { StaticAlert } from '~/Components/Alert.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { base64EncodeUint8Array } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ExportWizardModal } from './Export.js'
import { ImportWizard } from './Import/index.js'
import { ResetWizardModal } from './Reset.js'

const NOTIFICATION_ID_IMPORT = 'import_config_file'

export const ImportExportPage = observer(function ImportExport() {
	const { notifier, connections } = useContext(RootAppStoreContext)

	const [loadError, setLoadError] = useState<string | null>(null)

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
											userData: null,
										})

										if (err || !config) {
											setLoadError(err || 'Failed to prepare')
										} else {
											const initialRemap: Record<string, string | undefined> = {}

											// Figure out some initial mappings. Look for matching type and hopefully label
											for (const [id, obj] of Object.entries(config.connections ?? {})) {
												if (!obj) continue

												const candidateIds = []
												let matchingLabelId = ''

												for (const [otherId, otherObj] of connections.connections.entries()) {
													if (otherObj.moduleId === obj.moduleId) {
														candidateIds.push(otherId)
														if (otherObj.label === obj.label) {
															matchingLabelId = otherId
														}
													}
												}

												if (BANNED_PROPS.has(id)) continue
												if (matchingLabelId) {
													initialRemap[id] = matchingLabelId
												} else {
													initialRemap[id] = candidateIds[0] || ''
												}
											}

											setLoadError(null)
											notifier.close(NOTIFICATION_ID_IMPORT)
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
		<div className="page-shell">
			<PageHeader icon={faFileImport} title="Import / Export" helpAction="/user-guide/config/import-export" />

			<div className="page-scroll">
				<PageIntro title="Configuration Management">
					Export custom configuration backups, restore from a snapshot, or reset Companion configuration.
				</PageIntro>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Export Card */}
					<div className="flex flex-col justify-between p-5 rounded-xl border border-emerald-500/25 bg-surface hover:border-emerald-500/50 hover:shadow-sm transition-all">
						<div>
							<div className="flex items-center gap-3 mb-3">
								<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
									<FontAwesomeIcon icon={faDownload} className="text-base" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-body mb-0">Export Configuration</h3>
									<span className="text-2xs text-emerald-600 font-medium">Backup & Share</span>
								</div>
							</div>
							<p className="text-xs text-muted leading-relaxed mb-4">
								Download a custom <b>.companionconfig</b> backup file containing your connections, button pages,
								surfaces, triggers, and variables.
							</p>
						</div>
						<div>
							<ExportWizardModal />
						</div>
					</div>

					{/* Import Card */}
					<div className="flex flex-col justify-between p-5 rounded-xl border border-amber-500/25 bg-surface hover:border-amber-500/50 hover:shadow-sm transition-all">
						<div>
							<div className="flex items-center gap-3 mb-3">
								<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 font-bold">
									<FontAwesomeIcon icon={faFileImport} className="text-base" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-body mb-0">Import Configuration</h3>
									<span className="text-2xs text-amber-600 font-medium">Restore Snapshot</span>
								</div>
							</div>
							<p className="text-xs text-muted leading-relaxed mb-4">
								Browse your computer for a <b>.companionconfig</b> or <b>.yaml</b> backup file to restore or merge into
								Companion.
							</p>
						</div>

						<div>
							{!fileApiIsSupported ? (
								<StaticAlert color="warning">File uploading is not supported in your browser</StaticAlert>
							) : (
								<>
									{loadError && <StaticAlert color="warning">{loadError}</StaticAlert>}
									<label className="button button-warning button-file w-full flex items-center justify-center">
										<FontAwesomeIcon icon={faFileImport} className="me-2" />
										Import configuration
										<input
											type="file"
											onChange={loadSnapshot}
											className="hidden"
											accept={isMobileSafari ? undefined : '.companionconfig,.yaml'}
										/>
									</label>
								</>
							)}
						</div>
					</div>

					{/* Reset Card */}
					<div className="flex flex-col justify-between p-5 rounded-xl border border-rose-500/25 bg-surface hover:border-rose-500/50 hover:shadow-sm transition-all">
						<div>
							<div className="flex items-center gap-3 mb-3">
								<span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 font-bold">
									<FontAwesomeIcon icon={faTrashAlt} className="text-base" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-body mb-0">Reset Companion</h3>
									<span className="text-2xs text-rose-600 font-medium">Clear Configuration</span>
								</div>
							</div>
							<p className="text-xs text-muted leading-relaxed mb-4">
								Selectively clear connections, triggers, buttons, or custom variables to reset Companion back to a fresh
								state.
							</p>
						</div>
						<div>
							<ResetWizardModal />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
})
