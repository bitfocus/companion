import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CCol, CRow, CFormSelect } from '@coreui/react'
import { ConnectionsContext, MyErrorBoundary, SocketContext, socketEmitPromise } from '../../util.js'
import { ButtonGridHeader } from '../../Buttons/ButtonGridHeader.js'
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
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
	doImport: (importPageNumber: number, pageNumber: number, instanceRemap: Record<string, string | undefined>) => void
}

export const ImportPageWizard = observer(function ImportPageWizard({
	snapshot,
	instanceRemap,
	setInstanceRemap,
	doImport,
}: ImportPageWizardProps) {
	const { pages, userConfig } = useContext(RootAppStoreContext)

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

	return (
		<CRow className="">
			<CCol xs={12} xl={6}>
				<h5>Source Page</h5>
				<MyErrorBoundary>
					<>
						<CCol sm={12}>
							<ButtonGridHeader
								pageNumber={isSinglePage ? (snapshot.oldPageNumber ?? 1) : importPageNumber}
								changePage={isSinglePage ? undefined : changeImportPage}
								setPage={isSinglePage ? undefined : setImportPageNumber}
							>
								<CButton color="light" className="btn-right" title="Home Position" onClick={resetSourcePosition}>
									<FontAwesomeIcon icon={faHome} />
								</CButton>
							</ButtonGridHeader>
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
					<ImportRemap snapshot={snapshot} instanceRemap={instanceRemap} setInstanceRemap={setInstanceRemap2} />
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
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: (fromId: string, toId: string) => void
}

export function ImportRemap({ snapshot, instanceRemap, setInstanceRemap }: ImportRemapProps) {
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
					{sortedInstances.map(([key, instance]) => (
						<ImportRemapRow
							key={key}
							id={key}
							instance={instance}
							instanceRemap={instanceRemap}
							setInstanceRemap={setInstanceRemap}
						/>
					))}
				</tbody>
			</table>
		</div>
	)
}

interface ImportRemapRowProps {
	id: string
	instance: ClientImportObjectInstance
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: (fromId: string, toId: string) => void
}

const ImportRemapRow = observer(function ImportRemapRow({
	id,
	instance,
	instanceRemap,
	setInstanceRemap,
}: ImportRemapRowProps) {
	const { modules } = useContext(RootAppStoreContext)
	const connectionsContext = useContext(ConnectionsContext)

	const snapshotModule = modules.modules.get(instance.instance_type)
	const currentInstances = Object.entries(connectionsContext).filter(
		([_id, inst]) => inst.instance_type === instance.instance_type
	)

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => setInstanceRemap(id, e.currentTarget.value),
		[setInstanceRemap]
	)

	return (
		<tr>
			<td>
				{snapshotModule ? (
					<CFormSelect value={instanceRemap[id] ?? ''} onChange={onChange}>
						<option value="_new">[ Create new connection ]</option>
						<option value="_ignore">[ Ignore ]</option>
						{currentInstances.map(([id, inst]) => (
							<option key={id} value={id}>
								{inst.label}
							</option>
						))}
					</CFormSelect>
				) : (
					'Ignored'
				)}
			</td>
			<td>{snapshotModule ? snapshotModule.name : `Unknown module (${instance.instance_type})`}</td>
			<td>{instance.label}</td>
		</tr>
	)
})

function ButtonImportPreview({ ...props }: ButtonInfiniteGridButtonProps) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState<string | null>(null)

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
