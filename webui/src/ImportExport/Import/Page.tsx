import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CCol, CRow, CFormSelect } from '@coreui/react'
import { MyErrorBoundary, SocketContext } from '../../util.js'
import { ButtonGridHeader, PageNumberOption, PageNumberPicker } from '../../Buttons/ButtonGridHeader.js'
import { usePagePicker } from '../../Hooks/usePagePicker.js'
import {
	ButtonGridIcon,
	ButtonGridIconBase,
	ButtonInfiniteGrid,
	ButtonInfiniteGridButtonProps,
	ButtonInfiniteGridRef,
} from '../../Buttons/ButtonInfiniteGrid.js'
import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useHasBeenRendered } from '../../Hooks/useHasBeenRendered.js'
import type { ClientImportObject, ClientImportObjectInstance } from '@companion-app/shared/Model/ImportExport.js'
import { compareExportedInstances } from '@companion-app/shared/Import.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ButtonGridZoomControl } from '../../Buttons/ButtonGridZoomControl.js'
import { useGridZoom } from '../../Buttons/GridZoom.js'

interface ImportPageWizardProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
	doImport: (importPageNumber: number, pageNumber: number, connectionRemap: Record<string, string | undefined>) => void
}

export const ImportPageWizard = observer(function ImportPageWizard({
	snapshot,
	connectionRemap,
	setConnectionRemap,
	doImport,
}: ImportPageWizardProps) {
	const { pages, userConfig } = useContext(RootAppStoreContext)

	const isSinglePage = snapshot.type === 'page'

	const [snapshotPageOptions, pageCount] = useMemo(() => {
		if (isSinglePage) {
			const snapshotPageOptions: PageNumberOption[] = [
				{
					value: 1,
					label: snapshot.page?.name ? `1 (${snapshot.page.name})` : '1',
				},
			]
			return [snapshotPageOptions, 1]
		} else {
			const snapshotPageOptions: PageNumberOption[] = []
			let pageCount = 0
			for (const [pageNumber, pageInfo] of Object.entries(snapshot.pages ?? {})) {
				const pageNumberInt = parseInt(pageNumber)
				pageCount = Math.max(pageCount, pageNumberInt)

				snapshotPageOptions.push({
					value: pageNumberInt,
					label: pageInfo.name ? `${pageNumberInt} (${pageInfo.name})` : `${pageNumberInt}`,
				})
			}

			return [snapshotPageOptions, pageCount]
		}
	}, [snapshot.pages, snapshot.page, isSinglePage])

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages.data.length, 1)
	const {
		pageNumber: importPageNumber,
		setPageNumber: setImportPageNumber,
		changePage: changeImportPage,
	} = usePagePicker(pageCount, 1)

	const setConnectionRemap2 = useCallback(
		(fromId: string, toId: string) => {
			setConnectionRemap((oldRemap) => ({
				...oldRemap,
				[fromId]: toId,
			}))
		},
		[setConnectionRemap]
	)

	const doImport2 = useCallback(() => {
		doImport(importPageNumber, pageNumber, connectionRemap)
	}, [doImport, importPageNumber, pageNumber, connectionRemap])

	const destinationGridSize = userConfig.properties?.gridSize

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

	const [gridZoomController, gridZoomValue] = useGridZoom('import')

	console.log('sn', snapshotPageOptions, snapshot)

	return (
		<CRow className="">
			<CCol xs={12} xl={6}>
				<h5>Source Page</h5>
				<MyErrorBoundary>
					<>
						<CCol sm={12}>
							<PageNumberPicker
								pageNumber={isSinglePage ? (snapshot.oldPageNumber ?? 1) : importPageNumber}
								changePage={isSinglePage ? undefined : changeImportPage}
								setPage={isSinglePage ? undefined : setImportPageNumber}
								pageOptions={snapshotPageOptions}
							>
								<CButton color="light" className="btn-right" title="Home Position" onClick={resetSourcePosition}>
									<FontAwesomeIcon icon={faHome} />
								</CButton>
							</PageNumberPicker>
						</CCol>
						<div className="buttongrid" ref={hasBeenRenderedRef}>
							{hasBeenRendered && sourceGridSize && (
								<ButtonInfiniteGrid
									ref={sourceGridRef}
									pageNumber={isSinglePage ? (snapshot.oldPageNumber ?? 1) : importPageNumber}
									gridSize={sourceGridSize}
									buttonIconFactory={ButtonImportPreview}
									drawScale={gridZoomValue / 100}
								/>
							)}
						</div>
					</>
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6}>
				<h5>Destination Page</h5>
				<MyErrorBoundary>
					<>
						<CCol sm={12}>
							<ButtonGridHeader pageNumber={pageNumber} changePage={changePage} setPage={setPageNumber} newPageAtEnd>
								<ButtonGridZoomControl
									useCompactButtons={true}
									gridZoomValue={gridZoomValue}
									gridZoomController={gridZoomController}
								/>

								<CButton color="light" className="btn-right" title="Home Position" onClick={resetDestinationPosition}>
									<FontAwesomeIcon icon={faHome} />
								</CButton>
							</ButtonGridHeader>
						</CCol>
						<div className="buttongrid">
							{hasBeenRendered && destinationGridSize && (
								<ButtonInfiniteGrid
									ref={destinationGridRef}
									pageNumber={pageNumber}
									gridSize={destinationGridSize}
									buttonIconFactory={ButtonGridIcon}
									drawScale={gridZoomValue / 100}
								/>
							)}
						</div>
					</>
				</MyErrorBoundary>
			</CCol>
			<CCol xs={12}>
				<p>&nbsp;</p>
			</CCol>
			<CCol xs={12}>
				<MyErrorBoundary>
					<ImportRemap snapshot={snapshot} connectionRemap={connectionRemap} setConnectionRemap={setConnectionRemap2} />
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12}>
				<CButton color="warning" onClick={doImport2} disabled={isRunning}>
					{pageNumber == -1 ? 'Import to new page' : `Import to page ${pageNumber}`}
				</CButton>
			</CCol>
		</CRow>
	)
})

interface ImportRemapProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: (fromId: string, toId: string) => void
}

export function ImportRemap({ snapshot, connectionRemap, setConnectionRemap }: ImportRemapProps) {
	const sortedConnections = useMemo(() => {
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
					{sortedConnections.length === 0 && (
						<tr>
							<td colSpan={3}>No connections</td>
						</tr>
					)}
					{sortedConnections.map(([key, connection]) => (
						<ImportRemapRow
							key={key}
							id={key}
							connection={connection}
							connectionRemap={connectionRemap}
							setConnectionRemap={setConnectionRemap}
						/>
					))}
				</tbody>
			</table>
		</div>
	)
}

interface ImportRemapRowProps {
	id: string
	connection: ClientImportObjectInstance
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: (fromId: string, toId: string) => void
}

const ImportRemapRow = observer(function ImportRemapRow({
	id,
	connection,
	connectionRemap,
	setConnectionRemap,
}: ImportRemapRowProps) {
	const { connections, modules } = useContext(RootAppStoreContext)

	const snapshotModule = modules.modules.get(connection.instance_type)
	const currentConnections = connections.getAllOfType(connection.instance_type)

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => setConnectionRemap(id, e.currentTarget.value),
		[setConnectionRemap]
	)

	return (
		<tr>
			<td>
				{snapshotModule ? (
					<CFormSelect value={connectionRemap[id] ?? ''} onChange={onChange}>
						<option value="_new">[ Create new connection ]</option>
						<option value="_ignore">[ Ignore ]</option>
						{currentConnections.map(([id, conn]) => (
							<option key={id} value={id}>
								{conn.label}
							</option>
						))}
					</CFormSelect>
				) : (
					'Ignored'
				)}
			</td>
			<td>{snapshotModule ? snapshotModule.name : `Unknown module (${connection.instance_type})`}</td>
			<td>{connection.label}</td>
		</tr>
	)
})

function ButtonImportPreview({ ...props }: ButtonInfiniteGridButtonProps) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState<string | null>(null)

	useEffect(() => {
		setPreviewImage(null)

		socket
			.emitPromise('loadsave:control-preview', [
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
