import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { InstancesContext, socketEmitPromise, SocketContext, NotifierContext, ModulesContext } from '../util'
import { CreateBankControlId } from '@companion/shared/ControlId'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import {
	CButton,
	CAlert,
	CSelect,
	CButtonGroup,
	CModal,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CCol,
	CRow,
} from '@coreui/react'
import { ButtonPreview, dataToButtonImage } from '../Components/ButtonPreview'
import { MAX_COLS, MAX_ROWS } from '../Constants'
import { ButtonGridHeader } from './ButtonGrid'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

export function ImportExport({ pageNumber }) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)

	const confirmModalRef = useRef()

	const [snapshot, setSnapshot] = useState(null)
	const [importPage, setImportPage] = useState(1)
	const [importMode, setImportMode] = useState(null)
	const [instanceRemap, setInstanceRemap] = useState({})
	const [isRunning, setIsRunning] = useState(false)

	const fileApiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const [loadError, setLoadError] = useState(null)
	const clearSnapshot = useCallback(() => {
		setSnapshot(null)
		socketEmitPromise(socket, 'loadsave:abort', [])
	}, [socket])
	const loadSnapshot = useCallback(
		(e) => {
			const newFiles = e.currentTarget.files
			e.currentTarget.files = null
			if (fileApiIsSupported) {
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
								setImportMode(config.type === 'page' ? 'page' : null)
							}
						})
						.catch((e) => {
							setLoadError('Failed to load config to import')
							console.error('Failed to load config to import:', e)
						})
				}
				fr.readAsText(newFiles[0])
			} else {
				setLoadError('Companion requires a more modern browser')
			}
		},
		[socket, instancesContext, fileApiIsSupported]
	)

	const doImport = useCallback(() => {
		setIsRunning(true)
		socketEmitPromise(socket, 'loadsave:import-page', [pageNumber, importPage, instanceRemap])
			.then((instanceRemap2) => {
				if (instanceRemap2) setInstanceRemap(instanceRemap2)

				setSnapshot((oldSnapshot) => {
					if (oldSnapshot?.type === 'page') {
						// If we imported a page, we can clear it now
						return null
					} else {
						return oldSnapshot
					}
				})
			})
			.catch((e) => {
				console.error(`Import failed: ${e}`)
			})
			.finally(() => {
				setIsRunning(false)
			})
	}, [socket, pageNumber, importPage, instanceRemap])

	const changePage = useCallback(
		(delta) => {
			const pageNumbers = Object.keys(snapshot?.pages ?? {})
			const currentIndex = pageNumbers.findIndex((p) => p === importPage + '')
			let newPage = pageNumbers[0]
			if (currentIndex !== -1) {
				let newIndex = currentIndex + delta
				if (newIndex < 0) newIndex += pageNumbers.length
				if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

				newPage = pageNumbers[newIndex]
			}

			if (newPage !== undefined) {
				setImportPage(newPage)
			}
		},
		[importPage, snapshot?.pages]
	)
	const setPage = useCallback(
		(newPage) => {
			const pageNumbers = Object.keys(snapshot?.config ?? {})
			const newIndex = pageNumbers.findIndex((p) => p === newPage + '')
			if (newIndex !== -1) {
				setImportPage(newPage)
			}
		},
		[snapshot?.config]
	)

	const doFullImport = useCallback(() => {
		confirmModalRef.current.show('Replace config', 'Are you sure you wish to replace the config?', 'Import', () => {
			setIsRunning(true)
			socketEmitPromise(socket, 'loadsave:import-full', [snapshot])
				.then(() => {
					window.location.reload()
				})
				.catch((e) => {
					console.error('Failed to import full config: ', e)
					window.location.reload()
				})
		})
	}, [socket, snapshot])

	const setInstanceRemap2 = useCallback((fromId, toId) => {
		setInstanceRemap((oldRemap) => ({
			...oldRemap,
			[fromId]: toId,
		}))
	}, [])

	if (snapshot) {
		const isSinglePage = snapshot.type === 'page'

		return (
			<>
				<h4>
					Import Configuration
					<CButton color="danger" size="sm" onClick={clearSnapshot} disabled={isRunning}>
						Cancel
					</CButton>
				</h4>

				<GenericConfirmModal ref={confirmModalRef} />

				<ButtonGridHeader
					pageNumber={importPage}
					pageName={isSinglePage ? snapshot.page.name : snapshot.pages[importPage]?.name}
					changePage={isSinglePage ? null : changePage}
					setPage={isSinglePage ? null : setPage}
				/>
				<CRow className="bankgrid">
					<ButtonImportGrid
						page={isSinglePage ? snapshot.oldPageNumber : importPage}
						// config={isSinglePage ? snapshot.config : snapshot.config[importPage]}
					/>
				</CRow>

				{!importMode && (
					<div>
						<h5>What to do</h5>
						<CButtonGroup>
							<CButton color="primary" onClick={() => setImportMode('page')} disabled={isRunning}>
								Import individual pages
							</CButton>
							<CButton color="warning" onClick={doFullImport} disabled={isRunning}>
								Replace current configuration
							</CButton>
						</CButtonGroup>
					</div>
				)}

				{importMode === 'page' && (
					<div id="import_resolve">
						<h5>Link config connections with local connections</h5>

						<table className="table table-responsive-sm">
							<thead>
								<tr>
									<th>Select connection</th>
									<th>Config connection type</th>
									<th>Config connection name</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(snapshot.instances || {}).map(([key, instance]) => {
									const snapshotModule = modules[instance.instance_type]
									const currentInstances = Object.entries(instancesContext).filter(
										([id, inst]) => inst.instance_type === instance.instance_type
									)

									return (
										<tr>
											<td>
												{snapshotModule ? (
													<CSelect
														disabled={isRunning}
														value={instanceRemap[key] ?? ''}
														onChange={(e) => setInstanceRemap2(key, e.target.value)}
													>
														<option value="">[ Create new connection ]</option>
														{currentInstances.map(([id, inst]) => (
															<option key={id} value={id}>
																{inst.label}
															</option>
														))}
													</CSelect>
												) : (
													'Ignored'
												)}
											</td>
											<td>{snapshotModule ? snapshotModule.name : `Unknown module (${instance.instance_type})`}</td>
											<td>{instance.label}</td>
										</tr>
									)
								})}
							</tbody>
						</table>

						<p>
							<CButton color="warning" onClick={doImport} disabled={isRunning}>
								Import to page {pageNumber}
							</CButton>
						</p>
					</div>
				)}
			</>
		)
	}

	return (
		<>
			<h5>Import configuration</h5>
			<p>
				Use the button below to browse your computer for a <b>.companionconfig</b> file containing either a full
				companion configuration, or a single page export.
			</p>

			{loadError ? <CAlert color="warning">{loadError}</CAlert> : ''}

			<label
				className="btn btn-success btn-file"
				title={fileApiIsSupported ? undefined : 'Not supported in your browser'}
			>
				<FontAwesomeIcon icon={faFileImport} /> Import
				<input type="file" onChange={loadSnapshot} style={{ display: 'none' }} disabled={!fileApiIsSupported} />
			</label>

			<hr />

			<FullExport />

			<hr />

			<ResetConfiguration />
		</>
	)
}

function ButtonImportGrid({ page }) {
	return (
		<>
			{Array(MAX_ROWS)
				.fill(0)
				.map((_, y) => {
					return (
						<CCol key={y} className="pagebank-row">
							{Array(MAX_COLS)
								.fill(0)
								.map((_, x) => {
									const index = y * MAX_COLS + x + 1
									return (
										<ButtonImportPreview key={x} controlId={CreateBankControlId(page, index)} alt={`Button ${index}`} />
									)
								})}
						</CCol>
					)
				})}
		</>
	)
}

function ButtonImportPreview({ controlId, instanceId, ...childProps }) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState(null)

	useEffect(() => {
		setPreviewImage(null)

		socketEmitPromise(socket, 'loadsave:control-preview', [controlId])
			.then((img) => {
				setPreviewImage(img ? dataToButtonImage(img) : null)
			})
			.catch((e) => {
				console.error(`Failed to preview bank: ${e}`)
			})
	}, [controlId, socket])

	return <ButtonPreview {...childProps} preview={previewImage} />
}

function FullExport() {
	return (
		<>
			<h5>Export full configuration</h5>
			<p>Download a file containing all connections and button pages.</p>
			<CButton color="success" href="/int/full_export" target="_new">
				<FontAwesomeIcon icon={faDownload} /> Export
			</CButton>
		</>
	)
}

function ResetConfiguration() {
	const resetModalRef = useRef()
	const doReset = useCallback(() => resetModalRef.current.show(), [])

	return (
		<>
			<h5>Reset all configuration</h5>
			<p>This will clear all connections, triggers and buttons and start over.</p>
			<p>
				<CButton color="danger" style={{ backgroundColor: 'rgba(180,0,0,1)' }} onClick={doReset}>
					<FontAwesomeIcon icon={faTrashAlt} /> Yes, reset everything
				</CButton>
			</p>
			<ConfirmFullResetModal ref={resetModalRef} />
		</>
	)
}

const ConfirmFullResetModal = forwardRef(function ConfirmFullResetModal(_props, ref) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const doReset = useCallback(() => {
		setShow(false)

		// Perform the reset
		socketEmitPromise(socket, 'loadsave:reset-full', [], 30000)
			.then(() => {
				window.location.reload()
			})
			.catch((e) => {
				notifier.current.show('Reset configuration', `Failed to reset configuration: ${e}`)
				console.error('Failed to reset configuration:', e)
			})
	}, [socket, notifier])

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
			},
		}),
		[]
	)

	return (
		<CModal show={show} onClose={doClose}>
			<CModalHeader closeButton>
				<h5>Reset Configuration</h5>
			</CModalHeader>
			<CModalBody>
				<p>Are you sure you want to reset the configuration?</p>
				<p>It is recommended to export the system configuration first</p>

				<CButton color="success" href="/int/full_export" target="_new">
					<FontAwesomeIcon icon={faDownload} /> Export
				</CButton>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="danger" onClick={doReset}>
					Reset
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
