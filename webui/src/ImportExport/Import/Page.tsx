import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CCol, CRow, CSelect } from '@coreui/react'
import {
	ConnectionsContext,
	ModulesContext,
	MyErrorBoundary,
	PagesContext,
	SocketContext,
	UserConfigContext,
	socketEmitPromise,
} from '../../util'
import { ButtonGridHeader } from '../../Buttons/ButtonGridHeader'
import { usePagePicker } from '../../Hooks/usePagePicker'
import {
	ButtonGridIcon,
	ButtonGridIconBase,
	ButtonInfiniteGrid,
	ButtonInfiniteGridButtonProps,
	ButtonInfiniteGridRef,
} from '../../Buttons/ButtonInfiniteGrid'
import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useHasBeenRendered } from '../../Hooks/useHasBeenRendered'
import type { ClientImportObject } from '@companion/shared/Model/ImportExport'
import { compareExportedInstances } from '@companion/shared/Import'

interface ImportPageWizardProps {
	snapshot: ClientImportObject
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
	doImport: (importPageNumber: number, pageNumber: number, instanceRemap: Record<string, string | undefined>) => void
}

export function ImportPageWizard({ snapshot, instanceRemap, setInstanceRemap, doImport }: ImportPageWizardProps) {
	const pages = useContext(PagesContext)
	const userConfig = useContext(UserConfigContext)

	const isSinglePage = snapshot.type === 'page'

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages, 1)
	const {
		pageNumber: importPageNumber,
		setPageNumber: setImportPageNumber,
		changePage: changeImportPage,
	} = usePagePicker(pages, 1)

	const setInstanceRemap2 = useCallback(
		(fromId: string, toId: string) => {
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

	const destinationGridSize = userConfig?.gridSize

	const destinationGridRef = useRef<ButtonInfiniteGridRef>(null)
	const resetDestinationPosition = useCallback(() => {
		destinationGridRef.current?.resetPosition()
	}, [destinationGridRef])

	const sourceGridRef = useRef<ButtonInfiniteGridRef>(null)
	const resetSourcePosition = useCallback(() => {
		sourceGridRef.current?.resetPosition()
	}, [sourceGridRef])

	const isRunning = false

	const sourcePageInfo = isSinglePage ? snapshot.page : snapshot.pages?.[importPageNumber]
	const sourceGridSize = sourcePageInfo?.gridSize ?? destinationGridSize

	const [hasBeenRendered, hasBeenRenderedRef] = useHasBeenRendered()

	return (
		<CRow className="">
			<CCol xs={12} xl={6}>
				<h5>Source Page</h5>
				<MyErrorBoundary>
					<div>
						<CCol sm={12}>
							<CButton
								color="light"
								style={{
									float: 'right',
									marginTop: 10,
								}}
								onClick={resetSourcePosition}
							>
								<FontAwesomeIcon icon={faHome} /> Home Position
							</CButton>

							<ButtonGridHeader
								pageNumber={isSinglePage ? snapshot.oldPageNumber ?? 1 : importPageNumber}
								changePage={isSinglePage ? undefined : changeImportPage}
								setPage={isSinglePage ? undefined : setImportPageNumber}
							/>
						</CCol>
						<div className="buttongrid" ref={hasBeenRenderedRef}>
							{hasBeenRendered && sourceGridSize && (
								<ButtonInfiniteGrid
									ref={sourceGridRef}
									pageNumber={isSinglePage ? snapshot.oldPageNumber ?? 1 : importPageNumber}
									gridSize={sourceGridSize}
									buttonIconFactory={ButtonImportPreview}
								/>
							)}
						</div>
					</div>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6}>
				<h5>Destination Page</h5>
				<MyErrorBoundary>
					<div>
						<CCol sm={12}>
							<CButton
								color="light"
								style={{
									float: 'right',
									marginTop: 10,
								}}
								onClick={resetDestinationPosition}
							>
								<FontAwesomeIcon icon={faHome} /> Home Position
							</CButton>

							<ButtonGridHeader pageNumber={pageNumber} changePage={changePage} setPage={setPageNumber} />
						</CCol>
						<div className="buttongrid">
							{hasBeenRendered && destinationGridSize && (
								<ButtonInfiniteGrid
									ref={destinationGridRef}
									pageNumber={pageNumber}
									gridSize={destinationGridSize}
									buttonIconFactory={ButtonGridIcon}
								/>
							)}
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

interface ImportRemapProps {
	snapshot: ClientImportObject
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: (fromId: string, toId: string) => void
}

export function ImportRemap({ snapshot, instanceRemap, setInstanceRemap }: ImportRemapProps) {
	const modules = useContext(ModulesContext)
	const connectionsContext = useContext(ConnectionsContext)

	const sortedInstances = useMemo(() => {
		if (!snapshot.instances) return []

		return Object.entries(snapshot.instances)
			.filter((ent) => !!ent[1])
			.sort(compareExportedInstances)
	}, [snapshot.instances])

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
					{sortedInstances.length === 0 && (
						<tr>
							<td colSpan={3}>No connections</td>
						</tr>
					)}
					{sortedInstances.map(([key, instance]) => {
						const snapshotModule = modules[instance.instance_type]
						const currentInstances = Object.entries(connectionsContext).filter(
							([_id, inst]) => inst.instance_type === instance.instance_type
						)

						return (
							<tr>
								<td>
									{snapshotModule ? (
										<CSelect
											value={instanceRemap[key] ?? ''}
											onChange={(e) => setInstanceRemap(key, e.currentTarget.value)}
										>
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

function ButtonImportPreview({ ...props }: ButtonInfiniteGridButtonProps) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState(null)

	useEffect(() => {
		setPreviewImage(null)

		socketEmitPromise(socket, 'loadsave:control-preview', [
			{
				pageNumber: props.pageNumber,
				column: props.column,
				row: props.row,
			},
		])
			.then((img) => {
				setPreviewImage(img)
			})
			.catch((e) => {
				console.error(`Failed to preview button: ${e}`)
			})
	}, [props.pageNumber, props.column, props.row, socket])

	return <ButtonGridIconBase {...props} image={previewImage} />
}
