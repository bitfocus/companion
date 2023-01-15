import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CButton, CCol, CRow, CSelect } from '@coreui/react'
import {
	InstancesContext,
	ModulesContext,
	MyErrorBoundary,
	PagesContext,
	SocketContext,
	socketEmitPromise,
} from '../../util'
import { ButtonPreview, dataToButtonImage } from '../../Components/ButtonPreview'
import { CreateBankControlId } from '@companion/shared/ControlId'
import { MAX_COLS, MAX_ROWS } from '../../Constants'
import { ButtonGrid, ButtonGridHeader, usePagePicker } from '../../Buttons/ButtonGrid'

export function ImportPageWizard({ snapshot, instanceRemap, setInstanceRemap, doImport }) {
	const pages = useContext(PagesContext)

	const isSinglePage = snapshot.type === 'page'

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages, 1)
	const {
		pageNumber: importPageNumber,
		setPageNumber: setImportPageNumber,
		changePage: changeImportPage,
	} = usePagePicker(pages, 1)

	const setInstanceRemap2 = useCallback(
		(fromId, toId) => {
			setInstanceRemap((oldRemap) => ({
				...oldRemap,
				[fromId]: toId,
			}))
		},
		[setInstanceRemap]
	)

	const doImport2 = useCallback(() => {
		doImport(importPageNumber, pageNumber, instanceRemap)
	}, [doImport, importPageNumber, pageNumber, instanceRemap])

	const isRunning = false

	return (
		<CRow className="">
			{/* <GenericConfirmModal ref={clearModalRef} /> */}

			<CCol xs={12} xl={6}>
				<h5>Source Page</h5>
				<MyErrorBoundary>
					<div>
						<CCol sm={12}>
							<ButtonGridHeader
								pageNumber={isSinglePage ? snapshot.oldPageNumber : importPageNumber}
								pageName={isSinglePage ? snapshot.page.name : snapshot.pages?.[importPageNumber]?.name}
								changePage={isSinglePage ? null : changeImportPage}
								setPage={isSinglePage ? null : setImportPageNumber}
							/>
						</CCol>
						<div className="bankgrid">
							<ButtonImportGrid page={isSinglePage ? snapshot.oldPageNumber : importPageNumber} />
						</div>
					</div>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6}>
				<h5>Destination Page</h5>
				<MyErrorBoundary>
					<div>
						<CCol sm={12}>
							<ButtonGridHeader
								pageNumber={pageNumber}
								pageName={pages[pageNumber]?.name ?? 'PAGE'}
								changePage={changePage}
								setPage={setPageNumber}
							/>
						</CCol>
						<div className="bankgrid">
							<ButtonGrid
								// bankClick={bankClick}
								pageNumber={pageNumber}
								// selectedButton={selectedControl}
							/>
						</div>
					</div>
				</MyErrorBoundary>
			</CCol>
			<CCol xs={12}>
				<p>&nbsp;</p>
			</CCol>
			<CCol xs={12}>
				<MyErrorBoundary>
					<ImportRemap snapshot={snapshot} instanceRemap={instanceRemap} setInstanceRemap={setInstanceRemap2} />
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12}>
				<CButton color="warning" onClick={doImport2} disabled={isRunning}>
					Import to page {pageNumber}
				</CButton>
			</CCol>
		</CRow>
	)
}

export function ImportRemap({ snapshot, instanceRemap, setInstanceRemap }) {
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)

	return (
		<div id="import_resolve">
			<h5>Link import connections with existing connections</h5>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Select connection</th>
						<th>Config connection type</th>
						<th>Config connection name</th>
					</tr>
				</thead>
				<tbody>
					{Object.keys(snapshot.instances || {}).length === 0 && (
						<tr>
							<td colSpan={3}>No connections</td>
						</tr>
					)}
					{Object.entries(snapshot.instances || {}).map(([key, instance]) => {
						const snapshotModule = modules[instance.instance_type]
						const currentInstances = Object.entries(instancesContext).filter(
							([id, inst]) => inst.instance_type === instance.instance_type
						)

						return (
							<tr>
								<td>
									{snapshotModule ? (
										<CSelect value={instanceRemap[key] ?? ''} onChange={(e) => setInstanceRemap(key, e.target.value)}>
											<option value="_new">[ Create new connection ]</option>
											<option value="_ignore">[ Ignore ]</option>
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
		</div>
	)
}

function ButtonImportGrid({ page }) {
	return (
		<div
			style={{
				paddingTop: 14,
				paddingBottom: 14,
				backgroundColor: '#222',
				borderRadius: 20,
				marginLeft: 14,
			}}
		>
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
		</div>
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
