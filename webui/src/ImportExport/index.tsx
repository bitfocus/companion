import React, { FormEvent, useCallback, useContext, useRef, useState } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { CAlert, CButton, CCallout } from '@coreui/react'
import { ResetWizardModal, ResetWizardModalRef } from './Reset.js'
import { ExportWizardModal, ExportWizardModalRef } from './Export.js'
import { ImportWizard } from './Import/index.js'
import type { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { observer } from 'mobx-react-lite'

export const ImportExportPage = observer(function ImportExport() {
	const { socket, connections } = useContext(RootAppStoreContext)

	const [loadError, setLoadError] = useState<string | null>(null)

	const resetRef = useRef<ResetWizardModalRef>(null)
	const exportRef = useRef<ExportWizardModalRef>(null)
	const doReset = useCallback(() => resetRef.current?.show(), [])
	const doExport = useCallback(() => exportRef.current?.show(), [])

	const [importInfo, setImportInfo] = useState<[ClientImportObject, Record<string, string | undefined>] | null>(null)
	const clearImport = useCallback(() => {
		setImportInfo(null)

		socket.emitPromise('loadsave:abort', []).catch((e) => {
			console.error('Failed to abort import', e)
		})
	}, [socket])

	const fileApiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const loadSnapshot = useCallback(
		(e: FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setLoadError('Unable to read config file')
				return
			}

			var fr = new FileReader()
			fr.onload = () => {
				if (!fr.result) {
					setLoadError('Failed to load file contents')
					return
				}

				setLoadError(null)
				socket
					.emitPromise('loadsave:prepare-import', [fr.result], 20000)
					.then(([err, config]) => {
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
									if (otherObj.instance_type === obj.instance_type) {
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
							// const mode = config.type === 'page' ? 'import_page' : 'import_full'
							// modalRef.current.show(mode, config, initialRemap)
							setImportInfo([config, initialRemap])
						}
					})
					.catch((e) => {
						setLoadError('Failed to load config to import')
						console.error('Failed to load config to import:', e)
					})
			}
			fr.readAsArrayBuffer(newFile)
		},
		[socket, connections]
	)

	if (importInfo) {
		return <ImportWizard importInfo={importInfo} clearImport={clearImport} />
	}

	return (
		<>
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
									accept=".companionconfig,.yaml"
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
		</>
	)
})
