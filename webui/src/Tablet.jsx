import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, SERVER_URL, socketEmit, useMountEffect } from './util'
import io from 'socket.io-client'
import { CButton, CCol, CContainer, CForm, CFormGroup, CInput, CInputCheckbox, CRow, CSelect } from '@coreui/react'
import shortid from 'shortid'
import { MAX_BUTTONS, MAX_COLS, MAX_ROWS } from './Constants'
import { BankPreview, dataToButtonImage } from './Components/BankButton'
import { useInView } from 'react-intersection-observer'
import * as queryString from 'query-string'
import rangeParser from 'parse-numeric-range'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import EventEmitter from 'eventemitter3'
import { useHistory } from 'react-router-dom'

const socket = new io(SERVER_URL)

/** Cache of images across grid components */
class ImageCache extends EventEmitter {
	constructor(socket) {
		super()

		this.socket = socket

		this.loadedPages = new Set()
		this.imageCache = new Map()

		this.socket.on('connect', () => {
			// resubscribe on reconnect
			for (const k of this.loadedPages.values()) {
				this._doSubscribe(k)
			}
		})

		this.socket.on('buttons_bank_data', this._updateImages)
	}

	loadPage(page) {
		if (!this.loadedPages.has(page)) {
			this.loadedPages.add(page)
			this._doSubscribe(page)
		}
	}

	getPage(page) {
		return this.imageCache.get(page) || {}
	}

	_doSubscribe(page) {
		const lastUpdated = {} // We won't ever have an existing data
		socketEmit(this.socket, 'web_buttons_page', [page, lastUpdated])
			.then(([n, data]) => {
				this._updateImages(n, data)
			})
			.catch((e) => {
				// TODO - report to user
				console.error(`Failed to load page buttons: ${e}`)
			})
	}

	_updateImages = (page, data) => {
		if (this.loadedPages.has(page)) {
			const newImages = { ...this.imageCache.get(page) }

			let changed = false
			for (let key = 1; key <= MAX_BUTTONS; ++key) {
				if (data[key] !== undefined) {
					changed = true
					newImages[key] = {
						image: dataToButtonImage(data[key].buffer),
						updated: data[key].updated,
					}
				}
			}

			this.imageCache.set(page, newImages)
			if (changed) {
				this.emit(`${page}`, newImages)
			}
		}
	}
}

export function Tablet() {
	const [pages, setPages] = useState(null)
	const [loadError, setLoadError] = useState(null)

	const [queryUrl, setQueryUrl] = useState(window.location.search)
	const { orderedPages, parsedQuery } = useMemo(() => {
		const parsedQuery = queryString.parse(queryUrl)

		const pagesRange = rangeParser(parsedQuery.pages ?? '').filter((p) => p >= 1 && p <= 99)

		return {
			parsedQuery,
			orderedPages: pagesRange,
		}
	}, [queryUrl])

	const imageCache = useMemo(() => new ImageCache(socket), [])

	const [retryToken, setRetryToken] = useState(shortid())
	const doRetryLoad = useCallback(() => setRetryToken(shortid()), [])
	useEffect(() => {
		setLoadError(null)
		setPages(null)

		socketEmit(socket, 'web_buttons', [])
			.then(([pages]) => {
				setLoadError(null)
				setPages(pages)
			})
			.catch((e) => {
				console.error('Failed to load pages list:', e)
				setLoadError(`Failed to load pages list`)
				setPages(null)
			})

		const updatePageInfo = (page, info) => {
			setPages((oldPages) => {
				if (oldPages) {
					return {
						...oldPages,
						[page]: info,
					}
				} else {
					return null
				}
			})
		}

		socket.on('set_page', updatePageInfo)

		return () => {
			socket.off('set_page', updatePageInfo)
		}
	}, [retryToken])

	useMountEffect(() => {
		const onConnect = () => {
			setRetryToken(shortid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	})

	// Compile the list of pages we will be showing
	let validPages = orderedPages.filter((p) => pages && !!pages[p])
	if (validPages.length === 0) validPages = Object.keys(pages || {}).map((p) => Number(p))

	let cols = Number(parsedQuery['cols'])
	if (isNaN(cols) || cols <= 0) cols = MAX_COLS
	let rows = Number(parsedQuery['rows'])
	if (isNaN(rows) || rows <= 0) rows = MAX_ROWS

	const layout = parsedQuery['layout']
	return (
		<div className="page-tablet">
			<CContainer fluid>
				{pages ? (
					<>
						<ConfigurePanel setQueryUrl={setQueryUrl} query={parsedQuery} orderedPages={orderedPages} />
						{layout === 'cycle' ? (
							<CyclePages
								socket={socket}
								pages={pages}
								imageCache={imageCache}
								orderedPages={validPages}
								query={parsedQuery}
								cols={cols}
								rows={rows}
							/>
						) : (
							<InfinitePages
								socket={socket}
								pages={pages}
								imageCache={imageCache}
								orderedPages={validPages}
								query={parsedQuery}
								cols={cols}
								rows={rows}
							/>
						)}
					</>
				) : (
					<CRow>
						<div className="cycle-layout">
							<div></div>
							<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} />
						</div>
					</CRow>
				)}
			</CContainer>
		</div>
	)
}

function ConfigurePanel({ setQueryUrl, query, orderedPages }) {
	const history = useHistory()

	const updateQueryUrl = useCallback(
		(key, value) => {
			setQueryUrl((oldUrl) => {
				const newQuery = queryString.parse(oldUrl)
				if (value === '' || value === undefined || value === null || value === false) {
					delete newQuery[key]
				} else if (value === true) {
					newQuery[key] = 1
				} else {
					newQuery[key] = value
				}

				const newStr = queryString.stringify(newQuery).replace('%2C', ',') // replace commas to make it readable
				console.log('new url', newStr)
				history.push(`?${newStr}`)
				return newStr
			})
			// const newQuery = {...query}

			// setQueryUrl(queryString.stringify(newQuery))
		},
		[setQueryUrl, history]
	)
	return (
		<CRow className="configure">
			<CCol sm={12}>
				<h3>Configure</h3>
				<CForm>
					<CRow>
						<CCol md={4} sm={6} xs={12}>
							<CFormGroup>
								<label>Pages</label>
								<p>use 1..6 for ranges, and commas for multiple selections. Follows provided order</p>
								<CInput
									value={query['pages'] || ''}
									onChange={(e) => updateQueryUrl('pages', e.currentTarget.value)}
									placeholder={'1..99'}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Rows</label>
								<CInput
									type="number"
									min={1}
									max={MAX_ROWS}
									value={query['rows'] || MAX_ROWS}
									onChange={(e) => updateQueryUrl('rows', e.currentTarget.value)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Columns</label>
								<CInput
									type="number"
									min={1}
									max={MAX_COLS}
									value={query['cols'] || MAX_COLS}
									onChange={(e) => updateQueryUrl('cols', e.currentTarget.value)}
								/>
							</CFormGroup>
						</CCol>
						<CCol md={4} sm={6} xs={12}>
							<CFormGroup>
								<label>Layout</label>
								<CSelect
									value={query['layout'] || 'infinite'}
									onChange={(e) => updateQueryUrl('layout', e.currentTarget.value)}
								>
									<option value="cycle">Cycle</option>
									<option value="infinite">Infinite</option>
								</CSelect>
							</CFormGroup>
							{/* <CFormGroup>
								<label>Current index</label>
								<CInput
									type="number"
									min={0}
									max={orderedPages.length - 1}
									value={query['index'] || 0}
									onChange={(e) => updateQueryUrl('index', e.currentTarget.value)}
								/>
							</CFormGroup> */}
						</CCol>

						{query['layout'] === 'cycle' ? (
							<>
								<CCol md={4} sm={6} xs={12}>
									<CFormGroup>
										<label>Loop pages</label>
										<CInputCheckbox
											type="checkbox"
											checked={!!query['loop']}
											value={true}
											onChange={(e) => updateQueryUrl('loop', !!e.currentTarget.checked)}
										/>
									</CFormGroup>
								</CCol>
							</>
						) : (
							<>
								<CCol md={4} sm={6} xs={12}>
									<CFormGroup>
										<label>No page headings</label>
										<CInputCheckbox
											type="checkbox"
											checked={!!query['noheadings']}
											value={true}
											onChange={(e) => updateQueryUrl('noheadings', !!e.currentTarget.checked)}
										/>
									</CFormGroup>
								</CCol>
							</>
						)}
					</CRow>
				</CForm>
			</CCol>
		</CRow>
	)
}

function clamp(val, max) {
	return Math.min(Math.max(0, val), max)
}

function CyclePages({ socket, pages, imageCache, orderedPages, query, cols, rows }) {
	const rawIndex = Number(query['index'])
	const loop = query['loop']
	const defaultIndex = isNaN(rawIndex) ? 0 : clamp(rawIndex, orderedPages.length - 1)

	const [currentIndex, setCurrentIndex] = useState(defaultIndex)
	// TODO - update url while cycling

	const safeIndex = clamp(currentIndex, orderedPages.length - 1)
	const currentPage = orderedPages[safeIndex]

	{
		// Ensure next and prev pages are preloaded for more seamless cycling
		const prevPage = orderedPages[safeIndex - 1]
		if (prevPage !== undefined) imageCache.loadPage(prevPage)
		const nextPage = orderedPages[safeIndex + 1]
		if (nextPage !== undefined) imageCache.loadPage(nextPage)
	}

	const prevPage = useCallback(() => {
		setCurrentIndex((oldIndex) => {
			if (oldIndex <= 0) {
				return orderedPages.length - 1
			} else {
				return oldIndex - 1
			}
		})
	}, [orderedPages])
	const nextPage = useCallback(() => {
		setCurrentIndex((oldIndex) => {
			if (oldIndex >= orderedPages.length - 1) {
				return 0
			} else {
				return oldIndex + 1
			}
		})
	}, [orderedPages])

	return (
		<CRow>
			<div className="cycle-layout">
				<MyErrorBoundary>
					{/* <div></div> */}
					<div className="cycle-heading">
						<h1 id={`page_${currentPage}`}>
							{pages[currentPage]?.name || ' '}

							{orderedPages.length > 1 ? (
								<>
									<CButton onClick={nextPage} disabled={!loop && currentIndex === orderedPages.length - 1} size="lg">
										<FontAwesomeIcon icon={faArrowRight} />
									</CButton>
									<CButton onClick={prevPage} disabled={!loop && currentIndex === 0} size="lg">
										<FontAwesomeIcon icon={faArrowLeft} />
									</CButton>
								</>
							) : (
								''
							)}
						</h1>
					</div>
					<div>
						<ButtonGrid
							key={currentPage}
							socket={socket}
							imageCache={imageCache}
							number={currentPage}
							cols={cols}
							rows={rows}
						/>
					</div>
				</MyErrorBoundary>
			</div>
		</CRow>
	)
}

function InfinitePages({ socket, pages, imageCache, orderedPages, query, cols, rows }) {
	const noHeadings = query['noheadings']

	const pageElements = orderedPages.map((number, i) => (
		<MyErrorBoundary key={i}>
			<div id={`index_${number}`}>
				{!noHeadings ? (
					<CRow>
						<h1>{pages[number]?.name}</h1>
					</CRow>
				) : (
					''
				)}
				<CRow>
					<ButtonGrid socket={socket} imageCache={imageCache} number={number} cols={cols} rows={rows} />
				</CRow>
			</div>
		</MyErrorBoundary>
	))

	return <>{pageElements}</>
}

function ButtonGrid({ socket, imageCache, number, cols, rows }) {
	const { ref, inView } = useInView({
		rootMargin: '50%',
		/* Optional options */
		threshold: 0,
	})

	// load existing images from the cache at mount
	const [images, setImages] = useState(() => imageCache.getPage(number))

	// Ensure the page is loaded when it comes into view
	useEffect(() => {
		if (inView) {
			imageCache.on(`${number}`, setImages)
			imageCache.loadPage(number)

			return () => {
				imageCache.off(`${number}`, setImages)
			}
		}
	}, [imageCache, number, inView])

	const bankClick = useCallback(
		(bank, pressed) => {
			socket.emit('hot_press', number, bank, pressed)
		},
		[socket, number]
	)

	return (
		<div ref={ref} className="bankgrid">
			{' '}
			{Array(Math.min(MAX_ROWS, rows))
				.fill(0)
				.map((_, y) => {
					return (
						<CCol key={y} sm={12} className="pagebank-row">
							{Array(Math.min(MAX_COLS, cols))
								.fill(0)
								.map((_, x) => {
									const index = y * MAX_COLS + x + 1
									return (
										<BankPreview
											key={x}
											page={number}
											index={index}
											preview={images[index]?.image}
											onClick={bankClick}
											alt={`Bank ${index}`}
											selected={false}
										/>
									)
								})}
						</CCol>
					)
				})}
		</div>
	)
}
