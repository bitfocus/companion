import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, SocketContext } from '../util'
import { CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import queryString from 'query-string'
import rangeParser from 'parse-numeric-range'
import { useNavigate } from 'react-router-dom'
import { usePagesInfoSubscription } from '../Hooks/usePagesInfoSubscription'
import { useUserConfigSubscription } from '../Hooks/useUserConfigSubscription'
import useElementclientSize from '../Hooks/useElementInnerSize'
import { ConfigurePanel } from './ConfigurePanel'
import { ButtonsFromPage } from './ButtonsFromPage'

export function TabletView() {
	const socket = useContext(SocketContext)

	const [loadError, setLoadError] = useState<string | null>(null)

	const [queryUrl, setQueryUrl] = useState(window.location.search)
	const { orderedPages, parsedQuery } = useMemo(() => {
		const rawParsedQuery = queryString.parse(queryUrl)

		const pagesStr = Array.isArray(rawParsedQuery.pages) ? rawParsedQuery.pages[0] : rawParsedQuery.pages
		const pagesRange = rangeParser(pagesStr ?? '').filter((p) => p >= 1 && p <= 99)

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

	const pages = usePagesInfoSubscription(socket, setLoadError, retryToken)
	const userConfig = useUserConfigSubscription(socket, setLoadError, retryToken)
	const rawGridSize = userConfig?.gridSize

	useEffect(() => {
		const onConnect = () => {
			setRetryToken(nanoid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	}, [socket])

	const navigate = useNavigate()
	const updateQueryUrl = useCallback(
		(key, value) => {
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
				navigate(`?${newStr}`)
				return newStr
			})
		},
		[setQueryUrl, navigate]
	)

	// Compile the list of pages we will be showing
	let validPages = orderedPages.filter((p) => pages && !!pages[p])
	if (validPages.length === 0) validPages = Object.keys(pages || {}).map((p) => Number(p))

	const gridSize = useMemo(() => {
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

	const rowsPerPage = Math.ceil((gridSize.columnCount * gridSize.rowCount) / displayColumns)
	const pageHeight = rowsPerPage * buttonSize
	const pageGroupStyle = useMemo(
		() => ({
			height: `${pageHeight}px`,
		}),
		[pageHeight]
	)

	return (
		<div className="page-tablet">
			<div className="scroller">
				<CContainer fluid className="d-flex flex-column">
					{pages && rawGridSize ? (
						<>
							<ConfigurePanel updateQueryUrl={updateQueryUrl} query={parsedQuery} gridSize={rawGridSize} />

							<div className="button-zone">
								<CRow>
									<CCol sm={12} className="buttongrid-row">
										<div ref={elementSizeRef} className="buttons-holder">
											{validPages.map((number, i) => (
												<MyErrorBoundary key={i}>
													{showPageHeadings ? (
														<>
															<div className="page-heading">
																<h1>{pages[number]?.name}</h1>
															</div>
															<div className="page-buttons" style={pageGroupStyle}>
																<ButtonsFromPage
																	pageNumber={number}
																	indexOffset={0}
																	displayColumns={displayColumns}
																	gridSize={gridSize}
																	buttonSize={buttonSize}
																/>
															</div>
														</>
													) : (
														<ButtonsFromPage
															pageNumber={number}
															indexOffset={i * gridSize.columnCount * gridSize.rowCount}
															displayColumns={displayColumns}
															gridSize={gridSize}
															buttonSize={buttonSize}
														/>
													)}
												</MyErrorBoundary>
											))}
										</div>
									</CCol>
								</CRow>
							</div>
						</>
					) : (
						<CRow className="flex-grow-1">
							<div className="cycle-layout">
								<div></div>
								<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} />
							</div>
						</CRow>
					)}
				</CContainer>
			</div>
		</div>
	)
}

function clampValue(value: number, min: number, max: number, fallback: number): number {
	const valueNumber = Number(value)
	if (isNaN(valueNumber)) return fallback

	if (valueNumber < min) return min
	if (valueNumber > max) return max

	return valueNumber
}
