import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CompanionContext, socketEmit } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileImport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { CButton, CAlert, CSelect, CButtonGroup } from '@coreui/react'
import update from 'immutability-helper'
import { BankPreview, dataToButtonImage } from '../Components/BankButton'
import { MAX_COLS, MAX_ROWS } from '../Constants'
import { BankGridHeader } from './Buttons'

export function ImportExport({ pageNumber }) {
	const context = useContext(CompanionContext)
	const [snapshot, setSnapshot] = useState(null)
	const [importPage, setImportPage] = useState(1)
	const [importMode, setImportMode] = useState(null)

	const clearSnapshot = useCallback(() => setSnapshot(null), [])
	const loadSnapshot = useCallback((e) => {
		const newFiles = e.currentTarget.files
		e.currentTarget.files = null
		if (window.File && window.FileReader && window.FileList && window.Blob) {
			if (!newFiles[0] === undefined || newFiles[0].type === undefined) {
				alert('Unable to read config file');
				return;
			}

			var fr = new FileReader();
			fr.onload = () => {
				socketEmit(context.socket, 'loadsave_import_config', [fr.result]).then(([err, config]) => {
					if (err) {
						alert(err)
					} else {
						for (const id in (config.instances || {})) {
							if (context.instances[id]) {
								config.instances[id].import_to = id
							} else {
								config.instances[id].import_to = 'new'
							}
						}

						setSnapshot(config)
						setImportMode(config.type === 'page' ? 'page' : null)
					}
				}).catch(e => {
					console.error('Failed to load config to import:', e)
				})
			};
			fr.readAsText(newFiles[0]);
		} else {
				alert('I am sorry, Companion requires a more modern browser');
		}
	}, [context.socket, context.instances])

	const doImport = useCallback(() => {
		// setSnapshot(null)

		snapshot.instances['bitfocus-companion'] = {
			'import_to': 'bitfocus-companion',
			'label': 'internal',
			'id': 'bitfocus-companion',
			'instance_type': 'bitfocus-companion'
		}

		// No response, we assume it was ok
		context.socket.emit('loadsave_import_page', pageNumber, importPage, snapshot);
	}, [context.socket, pageNumber, snapshot, importPage])

	const changePage = useCallback((delta) => {
		const pageNumbers = Object.keys(snapshot?.config ?? {})
		const currentIndex = pageNumbers.findIndex(p => p === importPage + '')
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
	}, [importPage, snapshot?.config])
	const setPage = useCallback((newPage) => {
		const pageNumbers = Object.keys(snapshot?.config ?? {})
		const newIndex = pageNumbers.findIndex(p => p === newPage + '')
		if (newIndex !== -1) {
			setImportPage(newPage)
		}
	}, [snapshot?.config])


	const doFullImport = useCallback(() => {
		if (window.confirm('Are you sure you wish to replace the config?')) {
			socketEmit(context.socket, 'loadsave_import_full', [snapshot]).then(() => {
				window.location.reload();
			}).catch(e => {
				console.error('Failed to import full config: ', e)
				window.location.reload();
			})
		}
	}, [context.socket, snapshot])

	if (snapshot) {
		const isSinglePage = snapshot.type === 'page'

		return <>
			<h4>
				Import Configuration 
				<CButton color='danger' size='sm' onClick={clearSnapshot}>Cancel</CButton>
			</h4>

			<BankGridHeader
				pageNumber={importPage}
				pageName={isSinglePage ? snapshot.page.name : snapshot.page[importPage].name}
				changePage={isSinglePage ? null : changePage}
				setPage={isSinglePage ? null : setPage}
			/>
			<BankGrid config={isSinglePage ? snapshot.config : snapshot.config[importPage]} />

			{
				!importMode
				? <div>
					<h5>What to do</h5>
					<CButtonGroup>
						<CButton color='primary' onClick={() => setImportPage('page')}>Import individual pages</CButton>
						<CButton color='warning' onClick={doFullImport}>Replace current configuration</CButton>
					</CButtonGroup>
				</div>
				: ''	
			}

			{
				importMode === 'page'
				? <div id="import_resolve">
					<h5>Link config instances with local instances</h5>

					<table className="table table-responsive-sm">
						<thead>
							<tr>
								<th>Select instance</th>
								<th>Config instance type</th>
								<th>Config instance name</th>
							</tr>
						</thead>
						<tbody>
							{
								Object.entries(snapshot.instances || {}).map(([key, instance]) => {
									if (key === 'companion-bitfocus' || instance.instance_type === 'bitfocus-companion') {
										return ''
									} else {

										const snapshotModule = context.modules[instance.instance_type]
										const currentInstances = Object.entries(context.instances).filter(([id, inst]) => inst.instance_type === instance.instance_type)

										return <tr>
											<td>
												<CSelect value={instance.import_to ?? 'new'} onChange={(e) => {
													setSnapshot(snapshot => update(snapshot, {
														instances: {
															[key]: {
																import_to: { $set: e.target.value }
															}
														}
													}))
												}}>
												<option value="new">[ Create new instance ]</option>
													{
														currentInstances.map(([id, inst]) => <option value={id}>{ inst.label }</option>)
													}
												</CSelect>
											</td>
											<td>{ snapshotModule?.label ?? 'Unknown module' }</td>
											<td>{ instance.label }</td>
										</tr>
									}
								})
							}
						</tbody>
					</table>

					<p>
						<CButton color='warning' onClick={doImport}>Import to page {pageNumber}</CButton>
					</p>

				</div>
				: ''
			}
		</>
	}

	return <>
		<h4>Import Configuration</h4>
		<p>Use the button below to browse your computer for a <b>.companionconfig</b> file containing either a full companion configuration, or just a single button page export.</p>
		<label className="btn btn-success btn-file">
			<FontAwesomeIcon icon={faFileImport} /> Import
			<input type="file" onChange={loadSnapshot} style={{display: 'none'}} />
		</label>

		<hr />

		<FullExport />

		<hr />
		
		<ResetConfiguration />
	</>
}

function BankGrid({config}) {
	return <>
		{
			Array(MAX_ROWS).fill(0).map((_, y) => {
				return <div key={y} className="pagebank-row">
					{
						Array(MAX_COLS).fill(0).map((_, x) => {
							const index = y * MAX_COLS + x + 1
							return (
								<BankGridPreview
									key={x}
									config={config[index]}
									alt={`Bank ${index}`}
								/>
							)
						})
					}
				</div>
			})
		}
	</>
}


function BankGridPreview({ config, instanceId, ...childProps }) {
	const context = useContext(CompanionContext)
	const [previewImage, setPreviewImage] = useState(null)

	useEffect(() => {
		socketEmit(context.socket, 'graphics_preview_generate', [config]).then(([img]) => {
			setPreviewImage(dataToButtonImage(img))
		}).catch(e => {
			console.error('Failed to preview bank')
		})
	}, [config, context.socket])

	return (
		<BankPreview fixedSize {...childProps} preview={previewImage} />
	)
}


function FullExport() {
	return <>
		<h4>Export full configuration</h4>
		<p>Download a file containing all instances and button pages.</p>
		<CButton color='success' href="/int/full_export" target="_new">
			<FontAwesomeIcon icon={faDownload} /> Export
		</CButton>
	</>
}

function ResetConfiguration() {
	const context = useContext(CompanionContext)

	const doReset = useCallback(() => {
		if (window.confirm('Are you sure you want to reset hte configuration')) {
			socketEmit(context.socket, 'reset_all', [])
			.then(() => {
				window.location.reload()
			})
			.catch((e) => {
				console.error('Failed to reset configuration:', e)
			})
		}
	}, [context.socket])

	return <>
		<h4>Reset full configuration</h4>
		<p>Remove all companion configuration. This will clear all instances and buttons and start over.</p>
		<p>
			<CButton color='danger' onClick={doReset}>
				<FontAwesomeIcon icon={faTrashAlt} /> Reset configuration
			</CButton>
		</p>
		<CAlert color='warning'>
			<strong>Something to know</strong>
			<br />
			There's been reports of weird stuff going on with import, export and reset.
			So, at this point after using any of the features, it's recommended to restart
			companion manually by exiting and reopening the applications. That's been known
			to fix most of the problems.
			</CAlert>
	</>
}