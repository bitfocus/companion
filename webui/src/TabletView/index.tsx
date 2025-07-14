import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, SocketContext } from '~/util.js'
import { CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import queryString from 'query-string'
import rangeParser from 'parse-numeric-range'
import { usePagesInfoSubscription } from '~/Hooks/usePagesInfoSubscription.js'
import { useUserConfigSubscription } from '~/Hooks/useUserConfigSubscription.js'
import useElementclientSize from '~/Hooks/useElementInnerSize.js'
import { ConfigurePanel } from './ConfigurePanel.js'
import { ButtonsBlock, ButtonWrapper, SectionOfButtons, TabletGridSize } from './ButtonsFromPage.js'
import { PagesStore } from '~/Stores/PagesStore.js'
import { observer } from 'mobx-react-lite'
import { UserConfigStore } from '~/Stores/UserConfigStore.js'
import { useNavigate } from '@tanstack/react-router'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'

export const TabletView = observer(function TabletView() {
	const socket = useContext(SocketContext)

	const navigate = useNavigate({ from: '/tablet' })

	const [loadError, setLoadError] = useState<string | null>(null)

	const [queryUrl, setQueryUrl] = useState(window.location.search)
	const { orderedPages, parsedQuery } = useMemo(() => {
		const rawParsedQuery = queryString.parse(queryUrl)

		const pagesStr = Array.isArray(rawParsedQuery.pages) ? rawParsedQuery.pages[0] : rawParsedQuery.pages
		const pagesRange = rangeParser(pagesStr ?? '').filter((p) => p >= 1)

		if (rawParsedQuery['max_col'] === undefined && rawParsedQuery['cols'])
			rawParsedQuery['max_col'] = Number(rawParsedQuery['cols']) - 1 + ''
		if (rawParsedQuery['max_row'] === undefined && rawParsedQuery['rows'])
			rawParsedQuery['max_row'] = Number(rawParsedQuery['rows']) - 1 + ''

		// Remove renamed properties
		delete rawParsedQuery['cols']
		delete rawParsedQuery['rows']

		const parsedQuery: Record<string, string> = {}
		for (const [key, value] of Object.entries(rawParsedQuery)) {
			if (Array.isArray(value)) {
				if (value[0]) {
					parsedQuery[key] = value[0]
				}
			} else if (value) {
				parsedQuery[key] = value
			}
		}

		return {
			parsedQuery,
			orderedPages: pagesRange,
		}
	}, [queryUrl])

	const [retryToken, setRetryToken] = useState(nanoid())
	const doRetryLoad = useCallback(() => setRetryToken(nanoid()), [])

	const pagesStore = useMemo(() => new PagesStore(), [])
	const pagesReady = usePagesInfoSubscription(socket, pagesStore, setLoadError, retryToken)

	const userConfigStore = useMemo(() => new UserConfigStore(), [])
	useUserConfigSubscription(socket, userConfigStore, setLoadError, retryToken)
	const rawGridSize = userConfigStore.properties?.gridSize

	useEffect(() => {
		document.title =
			userConfigStore.properties?.installName && userConfigStore.properties?.installName.length > 0
				? `${userConfigStore.properties?.installName} - Web Buttons (Bitfocus Companion)`
				: 'Bitfocus Companion - Web Buttons'
	}, [userConfigStore.properties?.installName])

	useEffect(() => {
		const unsub = socket.onConnect(() => {
			setRetryToken(nanoid())
		})

		return unsub
	}, [socket])

	const updateQueryUrl = useCallback(
		(key: string, value: any) => {
			setQueryUrl((oldUrl) => {
				const newQuery = queryString.parse(oldUrl)
				if (value === '' || value === undefined || value === null || value === false) {
					delete newQuery[key]
				} else if (value === true) {
					newQuery[key] = '1'
				} else {
					newQuery[key] = value
				}

				// Remove renamed properties
				delete newQuery['cols']
				delete newQuery['rows']

				const newStr = queryString.stringify(newQuery).replaceAll('%2C', ',') // replace commas to make it readable
				void navigate({ to: `?${newStr}` })
				return newStr
			})
		},
		[setQueryUrl, navigate]
	)

	// Compile the list of pages we will be showing
	const totalPageCount = pagesStore.data.length
	const validPages = orderedPages.filter((p) => p >= 1 && p <= totalPageCount)
	if (validPages.length === 0) {
		for (let i = 1; i <= totalPageCount; i++) {
			validPages.push(i)
		}
	}

	const gridSize: TabletGridSize = useMemo(() => {
		if (!rawGridSize)
			return {
				minColumn: 0,
				maxColumn: 0,
				minRow: 0,
				maxRow: 0,

				columnCount: 1,
				rowCount: 1,
				buttonCount: 1,
			}

		const maxColumn = clampValue(
			Number(parsedQuery['max_col']),
			rawGridSize.minColumn,
			rawGridSize.maxColumn,
			rawGridSize.maxColumn
		)
		const minColumn = clampValue(
			Number(parsedQuery['min_col']),
			rawGridSize.minColumn,
			maxColumn,
			rawGridSize.minColumn
		)
		const maxRow = clampValue(
			Number(parsedQuery['max_row']),
			rawGridSize.minRow,
			rawGridSize.maxRow,
			rawGridSize.maxRow
		)
		const minRow = clampValue(Number(parsedQuery['min_row']), rawGridSize.minRow, maxRow, rawGridSize.minRow)

		const columnCount = maxColumn - minColumn + 1
		const rowCount = maxRow - minRow + 1
		const buttonCount = columnCount * rowCount

		return {
			minColumn,
			maxColumn,
			minRow,
			maxRow,

			columnCount,
			rowCount,
			buttonCount,
		}
	}, [rawGridSize, parsedQuery])

	const showPageHeadings = parsedQuery['showpages']

	let displayColumns = Number(parsedQuery['display_cols'])
	if (displayColumns === 0 || isNaN(displayColumns)) displayColumns = gridSize.columnCount

	const [elementSizeRef, pageSize] = useElementclientSize<HTMLDivElement>()
	const buttonSize = pageSize.width / displayColumns

	return (
		<div className="page-tablet">
			<div className="scroller">
				<CContainer fluid className="d-flex flex-column">
					{pagesReady && rawGridSize ? (
						<>
							<ConfigurePanel updateQueryUrl={updateQueryUrl} query={parsedQuery} gridSize={rawGridSize} />

							<div className="button-zone">
								<CRow>
									<CCol sm={12} className="buttongrid-row">
										<div ref={elementSizeRef} className="buttons-holder">
											{showPageHeadings ? (
												<PagesWithHeadings
													validPages={validPages}
													displayColumns={displayColumns}
													gridSize={gridSize}
													buttonSize={buttonSize}
													pagesStore={pagesStore}
												/>
											) : (
												<InfiniteButtons
													validPages={validPages}
													displayColumns={displayColumns}
													gridSize={gridSize}
													buttonSize={buttonSize}
												/>
											)}
										</div>
									</CCol>
								</CRow>
							</div>
						</>
					) : (
						<CRow className="flex-grow-1">
							<div className="cycle-layout">
								<div></div>
								<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} design="pulse-xl" />
							</div>
						</CRow>
					)}
				</CContainer>
			</div>
		</div>
	)
})

interface PagesWithHeadingsProps {
	validPages: number[]
	displayColumns: number
	gridSize: TabletGridSize
	buttonSize: number
	pagesStore: PagesStore
}
const PagesWithHeadings = observer(function PagesWithHeadings({
	validPages,
	displayColumns,
	gridSize,
	buttonSize,
	pagesStore,
}: PagesWithHeadingsProps) {
	const rowsPerPage = Math.ceil((gridSize.columnCount * gridSize.rowCount) / displayColumns)
	const pageHeight = rowsPerPage * buttonSize
	const pageGroupStyle = useMemo(
		() => ({
			height: `${pageHeight}px`,
		}),
		[pageHeight]
	)

	return (
		<>
			{validPages.map((number, i) => (
				<MyErrorBoundary key={i}>
					<PageHeading pagesStore={pagesStore} pageNumber={number} />
					<div className="page-buttons" style={pageGroupStyle}>
						<SectionOfButtons
							pageNumber={number}
							displayColumns={displayColumns}
							gridSize={gridSize}
							buttonSize={buttonSize}
						/>
					</div>
				</MyErrorBoundary>
			))}
		</>
	)
})

interface InfiniteButtonsProps {
	validPages: number[]
	displayColumns: number
	gridSize: TabletGridSize
	buttonSize: number
}
const InfiniteButtons = observer(function InfiniteButtons({
	validPages,
	displayColumns,
	gridSize,
	buttonSize,
}: InfiniteButtonsProps) {
	const socket = useContext(SocketContext)

	const buttonClick = useCallback(
		(location: ControlLocation, pressed: boolean) => {
			socket
				.emitPromise('controls:hot-press', [location, pressed, 'tablet'])
				.catch((e) => console.error(`Hot press failed: ${e}`))
		},
		[socket]
	)

	const allLocations: ControlLocation[] = []
	for (const pageNumber of validPages) {
		for (let y = gridSize.minRow; y <= gridSize.maxRow; y++) {
			for (let x = gridSize.minColumn; x <= gridSize.maxColumn; x++) {
				allLocations.push({
					pageNumber,
					row: y,
					column: x,
				})
			}
		}
	}

	const rowsPerChunk = 2

	return (
		<>
			{Array.from(chunks(allLocations, displayColumns * rowsPerChunk)).map((locations, i) => (
				<MyErrorBoundary key={i}>
					<ButtonsBlock displayRows={rowsPerChunk} firstRowIndex={i * rowsPerChunk} buttonSize={buttonSize}>
						{locations.map((location, o) => {
							return (
								<ButtonWrapper
									key={`${location.pageNumber}_${location.row}_${location.column}`}
									pageNumber={location.pageNumber}
									column={location.column}
									row={location.row}
									buttonSize={buttonSize}
									displayColumn={o % displayColumns}
									displayRow={i * rowsPerChunk + Math.floor(o / displayColumns)}
									buttonClick={buttonClick}
								/>
							)
						})}
					</ButtonsBlock>
				</MyErrorBoundary>
			))}
		</>
	)
})

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
	for (let i = 0; i < arr.length; i += n) {
		yield arr.slice(i, i + n)
	}
}

interface PageHeadingProps {
	pagesStore: PagesStore
	pageNumber: number
}

const PageHeading = observer(function PageHeading({ pagesStore, pageNumber }: PageHeadingProps) {
	return (
		<div className="page-heading">
			<h1>{pagesStore.get(pageNumber)?.name}</h1>
		</div>
	)
})

function clampValue(value: number, min: number, max: number, fallback: number): number {
	const valueNumber = Number(value)
	if (isNaN(valueNumber)) return fallback

	if (valueNumber < min) return min
	if (valueNumber > max) return max

	return valueNumber
}
