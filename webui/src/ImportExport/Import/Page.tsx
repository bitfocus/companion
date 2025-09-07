import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { CButton, CCol, CRow, CFormSelect } from '@coreui/react'
import { MyErrorBoundary } from '~/Resources/Error'
import { ButtonGridHeader, PageNumberOption, PageNumberPicker } from '~/Buttons/ButtonGridHeader.js'
import { usePagePicker } from '~/Hooks/usePagePicker.js'
import {
	ButtonGridIcon,
	ButtonGridIconBase,
	ButtonInfiniteGrid,
	ButtonInfiniteGridButtonProps,
	ButtonInfiniteGridRef,
} from '~/Buttons/ButtonInfiniteGrid.js'
import { faFileCircleExclamation, faFileCirclePlus, faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useHasBeenRendered } from '~/Hooks/useHasBeenRendered.js'
import type { ClientImportObject, ClientImportObjectInstance } from '@companion-app/shared/Model/ImportExport.js'
import { compareExportedInstances } from '@companion-app/shared/Import.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ButtonGridZoomControl } from '~/Buttons/ButtonGridZoomControl.js'
import { useGridZoom } from '~/Buttons/GridZoom.js'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

interface ImportPageWizardProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
	doImport: (importPageNumber: number, pageNumber: number, connectionRemap: Record<string, string | undefined>) => void
	className?: string
}

export const ImportPageWizard = observer(function ImportPageWizard({
	snapshot,
	connectionRemap,
	setConnectionRemap,
	doImport,
	className,
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
		<>
			<h4>Buttons</h4>
			<p>
				Select a source page of buttons you want to import, and a destination page to import them. This can replace an
				existing page, or create a entirely new page.
			</p>
			<CRow className={className}>
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
								{hasBeenRendered && destinationGridSize && pageNumber != -1 && (
									<ButtonInfiniteGrid
										ref={destinationGridRef}
										pageNumber={pageNumber}
										gridSize={destinationGridSize}
										buttonIconFactory={ButtonGridIcon}
										drawScale={gridZoomValue / 100}
									/>
								)}
								{pageNumber === -1 && (
									<div
										style={{
											textAlign: 'center',
											fontSize: '1.5rem',
											marginTop: '5rem',
										}}
									>
										<FontAwesomeIcon icon={faFileCirclePlus} size="4x" />
										<p style={{ marginTop: '1rem' }}>The buttons will be imported to a new page.</p>
									</div>
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
						<ImportRemap
							snapshot={snapshot}
							connectionRemap={connectionRemap}
							setConnectionRemap={setConnectionRemap2}
						/>
					</MyErrorBoundary>
				</CCol>
				<h4 className="mt-3">Import Page</h4>
				<p>
					Clicking the button below will
					{pageNumber == -1
						? ' import the source page to a new page'
						: " completely override the existing destination page's buttons with the selected source page's buttons"}
					.
				</p>
				<CCol xs={12} className="mt-1">
					<CButton color={pageNumber == -1 ? 'success' : 'warning'} onClick={doImport2} disabled={isRunning}>
						<FontAwesomeIcon icon={pageNumber == -1 ? faFileCirclePlus : faFileCircleExclamation} />
						{pageNumber == -1 ? ' Import to new page' : ` Replace page ${pageNumber} with imported page`}
					</CButton>
				</CCol>
			</CRow>
		</>
	)
})

interface ImportRemapProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: (fromId: string, toId: string) => void
}

export function ImportRemap({ snapshot, connectionRemap, setConnectionRemap }: ImportRemapProps): React.JSX.Element {
	const sortedConnections = useMemo(() => {
		if (!snapshot.instances) return []

		return Object.entries(snapshot.instances)
			.filter((ent) => !!ent[1])
			.sort(compareExportedInstances)
	}, [snapshot.instances])

	return (
		<div id="import_resolve">
			<h5>Import Connections Behavior</h5>
			<p>
				If you have existing connections that match the type of connections in the import, you can link them here.
				Otherwise, new connections will be created for any connections left unlinked. You can also choose to ignore
				certain connections if they are not needed.
			</p>
			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Behavior</th>
						<th>Import Connection Type</th>
						<th>Import Connection Name</th>
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

	const storeInfo = modules.storeList.get(connection.instance_type)
	const moduleInfo = modules.modules.get(connection.instance_type)

	const moduleManifest = moduleInfo?.display ?? storeInfo

	const currentConnections = connections.getAllOfType(connection.instance_type)

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => setConnectionRemap(id, e.currentTarget.value),
		[setConnectionRemap, id]
	)

	return (
		<tr>
			<td>
				<CFormSelect value={connectionRemap[id] ?? ''} onChange={onChange}>
					<option value="_blank">[ Create new connection ]</option>
					<option value="_ignore">[ Ignore ]</option>
					{currentConnections.map(([id, conn]) => (
						<option key={id} value={id}>
							Link to {conn.label}
						</option>
					))}
				</CFormSelect>
			</td>
			<td>{moduleManifest?.name ?? `Unknown module (${connection.instance_type})`}</td>
			<td>{connection.label}</td>
		</tr>
	)
})

function ButtonImportPreview({ ...props }: ButtonInfiniteGridButtonProps) {
	const query = useQuery(
		trpc.importExport.controlPreview.queryOptions({
			location: {
				pageNumber: props.pageNumber,
				row: props.row,
				column: props.column,
			},
		})
	)

	return <ButtonGridIconBase {...props} image={query.data || null} />
}
