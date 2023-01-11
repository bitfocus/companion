import React, { useCallback, useContext, useRef, useState } from 'react'
import { InstancesContext, SocketContext, socketEmitPromise } from '../util'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { CAlert, CButton } from '@coreui/react'
import { WizardModal } from './Wizard'

export function ImportExport() {
	const socket = useContext(SocketContext)
	const instancesContext = useContext(InstancesContext)

	const [loadError, setLoadError] = useState(null)
	const [snapshot, setSnapshot] = useState(null)
	const [instanceRemap, setInstanceRemap] = useState({})

	const modalRef = useRef()
	const doReset = useCallback(() => modalRef.current.show('reset'), [])
	const doImport = useCallback(
		(mode) => modalRef.current.show(mode, snapshot, instanceRemap),
		[snapshot, instanceRemap]
	)

	const fileApiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const loadSnapshot = useCallback(
		(e) => {
			const newFiles = e.currentTarget.files
			e.currentTarget.files = null

			if (!newFiles[0] === undefined || newFiles[0].type === undefined) {
				setLoadError('Unable to read config file')
				return
			}

			var fr = new FileReader()
			fr.onload = () => {
				setLoadError(null)
				socketEmitPromise(socket, 'loadsave:prepare-import', [fr.result], 20000)
					.then(([err, config]) => {
						if (err) {
							setLoadError(err)
						} else {
							const initialRemap = {}

							// Figure out some initial mappings. Look for matching type and hopefully label
							for (const [id, obj] of Object.entries(config.instances)) {
								const candidateIds = []
								let matchingLabelId = ''

								for (const [otherId, otherObj] of Object.entries(instancesContext)) {
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
							setInstanceRemap(initialRemap)
							setSnapshot(config)
							doImport(config.type === 'page' ? 'import_page' : 'import_page')
						}
					})
					.catch((e) => {
						setLoadError('Failed to load config to import')
						console.error('Failed to load config to import:', e)
					})
			}
			fr.readAsText(newFiles[0])
		},
		[socket, instancesContext, doImport]
	)

	return (
		<>
			<h5>Import configuration</h5>
			{!fileApiIsSupported ? (
				<>
					<CAlert color="warning">Not supported in your browser</CAlert>
				</>
			) : (
				<>
					<p>
						Use the button below to browse your computer for a <b>.companionconfig</b> file containing a configuration
						set.
					</p>

					<p>
						{loadError ? <CAlert color="warning">{loadError}</CAlert> : ''}

						<label className="btn btn-success btn-file">
							<FontAwesomeIcon icon={faFileImport} /> Import
							<input type="file" onChange={loadSnapshot} style={{ display: 'none' }} />
						</label>
					</p>
				</>
			)}
			<hr />
			<h5>Export configuration</h5>
			<p>Download a file containing all connections and button pages.</p>
			<CButton color="success" href="/int/full_export" target="_new">
				<FontAwesomeIcon icon={faDownload} /> Export
			</CButton>
			<hr />
			<h5>Reset configuration</h5>
			<p>This will clear all connections, triggers and/or buttons.</p>
			<p>
				<CButton color="danger" style={{ backgroundColor: 'rgba(180,0,0,1)' }} onClick={doReset}>
					<FontAwesomeIcon icon={faTrashAlt} /> Reset Configuration
				</CButton>
			</p>
			<WizardModal ref={modalRef} />
		</>
	)
}
