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
import { faArrowLeft, faArrowRight, faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import EventEmitter from 'eventemitter3'
import { useHistory } from 'react-router-dom'

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
				console.error(`Failed to load page data: ${e}`)
			})
	}

	_updateImages = (page0, data) => {
		const page = Number(page0)
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

			if (changed) {
				this.emit(`${page}`, newImages)
			}
			this.imageCache.set(page, newImages)
		}
	}
}

function sanitisePageInfo(info) {
	const toNumArray = (raw) => {
		if (Array.isArray(raw)) {
			return raw.map((v) => Number(v))
		} else {
			return []
		}
	}

	return {
		...info,
		pageup: toNumArray(info.pageup),
		pagenum: toNumArray(info.pagenum),
		pagedown: toNumArray(info.pagedown),
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

	const [socket, imageCache] = useMemo(() => {
		const rawSocket = new io(SERVER_URL)
		return [rawSocket, new ImageCache(rawSocket)]
	}, [])

	const [retryToken, setRetryToken] = useState(shortid())
	const doRetryLoad = useCallback(() => setRetryToken(shortid()), [])
	useEffect(() => {
		setLoadError(null)
		setPages(null)

		socketEmit(socket, 'web_buttons', [])
			.then(([newPages]) => {
				setLoadError(null)
				const newPages2 = {}
				for (const [id, info] of Object.entries(newPages)) {
					newPages2[id] = sanitisePageInfo(info)
				}
				setPages(newPages2)
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
						[page]: sanitisePageInfo(info),
					}
				} else {
					return null
				}
			})
		}

		socket.on('page_update_ext', updatePageInfo)

		return () => {
			socket.off('page_update_ext', updatePageInfo)
		}
	}, [retryToken, socket])

	useMountEffect(() => {
		const onConnect = () => {
			setRetryToken(shortid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	})

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

				const newStr = queryString.stringify(newQuery).replaceAll('%2C', ',') // replace commas to make it readable
				history.push(`?${newStr}`)
				return newStr
			})
		},
		[setQueryUrl, history]
	)

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
			<div className="scroller">
				<CContainer fluid className="d-flex flex-column">
					{pages ? (
						<>
							<ConfigurePanel updateQueryUrl={updateQueryUrl} query={parsedQuery} orderedPages={orderedPages} />
							{layout === 'cycle' ? (
								<CyclePages
									socket={socket}
									pages={pages}
									imageCache={imageCache}
									orderedPages={validPages}
									updateQueryUrl={updateQueryUrl}
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

function ConfigurePanel({ updateQueryUrl, query, orderedPages }) {
	const [show, setShow] = useState(false)
	const [fullscreen, setFullscreen] = useState(document.fullscreenElement !== null)

	useMountEffect(() => {
		const handleChange = () => setFullscreen(document.fullscreenElement !== null)

		document.addEventListener('fullscreenchange', handleChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleChange)
		}
	})

	return show ? (
		<CRow className="configure">
			<CCol sm={12}>
				<h3>
					Configure Buttons View
					<CButton className="close-config" onClick={() => setShow(false)} title="Close">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				</h3>
				<CForm>
					<CRow>
						<CCol md={4} sm={6} xs={12}>
							<legend>Basic</legend>
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
							<legend>Layout</legend>
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
							<CFormGroup>
								<label>Hide configure button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['noconfigure']}
									value={true}
									onChange={(e) => updateQueryUrl('noconfigure', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Hide fullscreen button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['nofullscreen']}
									value={true}
									onChange={(e) => updateQueryUrl('nofullscreen', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
						</CCol>

						{query['layout'] === 'cycle' ? (
							<>
								<CCol md={4} sm={6} xs={12}>
									<legend>Cycle</legend>
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
									<legend>Infinite</legend>
									<CFormGroup>
										<label>Hide page headings</label>
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
	) : (
		<CRow className="header">
			<CCol xs={12}>
				{(!fullscreen || !query['noconfigure']) && !query['nofullscreen'] ? (
					<CButton onClick={() => document.documentElement.requestFullscreen()} title="Fullscreen">
						<FontAwesomeIcon icon={faExpand} />
					</CButton>
				) : (
					''
				)}
				{!query['noconfigure'] ? (
					<CButton className="open-config" onClick={() => setShow(true)} title="Configure">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				) : (
					''
				)}
			</CCol>
		</CRow>
	)
}

function clamp(val, max) {
	return Math.min(Math.max(0, val), max)
}

function CyclePages({ socket, pages, imageCache, orderedPages, updateQueryUrl, query, cols, rows }) {
	const rawIndex = Number(query['index'])
	const loop = query['loop']
	const currentIndex = isNaN(rawIndex) ? 0 : clamp(rawIndex, orderedPages.length - 1)
	const currentPage = orderedPages[currentIndex]

	const setCurrentIndex = useCallback((newIndex) => updateQueryUrl('index', newIndex), [updateQueryUrl])

	{
		// Ensure next and prev pages are preloaded for more seamless cycling
		const prevPage = orderedPages[currentIndex - 1]
		if (prevPage !== undefined) imageCache.loadPage(prevPage)
		const nextPage = orderedPages[currentIndex + 1]
		if (nextPage !== undefined) imageCache.loadPage(nextPage)
	}

	const goPrevPage = useCallback(() => {
		if (currentIndex <= 0) {
			if (loop) {
				setCurrentIndex(orderedPages.length - 1)
			}
		} else {
			setCurrentIndex(currentIndex - 1)
		}
	}, [orderedPages, setCurrentIndex, currentIndex, loop])
	const goNextPage = useCallback(() => {
		if (currentIndex >= orderedPages.length - 1) {
			if (loop) {
				setCurrentIndex(0)
			}
		} else {
			setCurrentIndex(currentIndex + 1)
		}
	}, [orderedPages, setCurrentIndex, currentIndex, loop])
	const goFirstPage = useCallback(() => setCurrentIndex(0), [setCurrentIndex])

	return (
		<CRow className="flex-grow-1">
			<div className="cycle-layout">
				<MyErrorBoundary>
					{/* <div></div> */}
					<div className="cycle-heading">
						<h1 id={`page_${currentPage}`}>
							{pages[currentPage]?.name || ' '}

							{orderedPages.length > 1 ? (
								<>
									<CButton onClick={goNextPage} disabled={!loop && currentIndex === orderedPages.length - 1} size="lg">
										<FontAwesomeIcon icon={faArrowRight} />
									</CButton>
									<CButton onClick={goPrevPage} disabled={!loop && currentIndex === 0} size="lg">
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
							pageInfo={pages[currentPage]}
							goFirstPage={goFirstPage}
							goNextPage={goNextPage}
							goPrevPage={goPrevPage}
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
					<ButtonGrid
						socket={socket}
						imageCache={imageCache}
						number={number}
						cols={cols}
						rows={rows}
						pageInfo={pages[number]}
					/>
				</CRow>
			</div>
		</MyErrorBoundary>
	))

	return <>{pageElements}</>
}

function ButtonGrid({ socket, imageCache, number, cols, rows, goFirstPage, goNextPage, goPrevPage, pageInfo }) {
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
			setImages(imageCache.getPage(number))
			imageCache.on(`${number}`, setImages)
			imageCache.loadPage(number)

			return () => {
				imageCache.off(`${number}`, setImages)
			}
		}
	}, [imageCache, number, inView])

	const bankClick = useCallback(
		(bank, pressed) => {
			if (goNextPage && pressed && pageInfo && pageInfo.pageup && pageInfo.pageup.includes(bank)) {
				goNextPage()
			} else if (goPrevPage && pressed && pageInfo && pageInfo.pagedown && pageInfo.pagedown.includes(bank)) {
				goPrevPage()
			} else if (goFirstPage && pressed && pageInfo && pageInfo.pagenum && pageInfo.pagenum.includes(bank)) {
				goFirstPage()
			} else {
				socket.emit('hot_press', number, bank, pressed)
			}
		},
		[socket, number, pageInfo, goNextPage, goPrevPage, goFirstPage]
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
								.map((_2, x) => {
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
