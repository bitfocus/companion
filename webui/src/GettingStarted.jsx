import { Fragment, useRef, useState, useEffect } from 'react'
import { useHash } from 'react-use'
import { SERVER_URL } from './util'
import ReactMarkdown from 'react-markdown'
import { useIntersectionObserver } from 'usehooks-ts'

const style = {
	header: {
		height: 49,
		borderBottom: '1px solid #ddd',
		backgroundColor: '#d50215',
		color: 'white',
		paddingLeft: 10,
		paddingTop: 5,
		zIndex: 300,
		position: 'relative',
		display: 'flex',
	},
	headerText: { lineHeight: '1.1em', marginTop: 4, marginLeft: 5 },
	menuWrapper: { backgroundColor: 'white', display: 'flex', zIndex: 1 },
	menuStructure: {
		width: '20vw',
		minWidth: 250,
		height: 'calc(100vh - 50px)',
		overflow: 'scroll',
		zIndex: 200,
		boxShadow: '-15px 2px 31px 22px rgba(100,100,100,0.1)',
	},
	contentGithubLink: {
		backgroundColor: '#f0f0f0',
		display: 'inline-block',
		borderRadius: 4,
		fontSize: 10,
		color: '#999',
		padding: '2px 5px',
		clear: 'both',
		float: 'right',
	},
	contentWrapper: {
		width: '80vw',
		maxWidth: 'calc(100vw - 250px)',
		height: 'calc(100vh - 50px)',
		overflow: 'scroll',
		backgroundColor: 'white',
		zIndex: 100,
		padding: 20,
		paddingLeft: 40,
	},
	contentWrapper2: {
		maxWidth: 1200,
	},
	menuChildren: { marginLeft: 3, borderLeft: '1px dotted gray', paddingLeft: 20, marginBottom: 10 },
	imgLink: { width: 12, opacity: 0.3, marginTop: -2, marginLeft: 4 },
}

export function GettingStarted() {
	const [hash] = useHash()
	const contentWrapperRef = useRef(null)
	const [structure, setStructure] = useState([])
	const [error, setError] = useState(null)
	const [loading, setLoading] = useState(true)
	const [visibleFiles, setVisibleFiles] = useState([])

	useEffect(() => {
		setTimeout(() => {
			if (contentWrapperRef.current) {
				// scroll to hash
				const el = contentWrapperRef.current.querySelector(`[anchor="${hash}"]`)
				if (el) {
					el.scrollIntoView({ behavior: 'smooth' })
				}
			}
		}, 50)
	}, [contentWrapperRef, hash])

	// Fetch ${SERVER_URL}/docs/structure.json and parse it
	useEffect(() => {
		const fetchData = async () => {
			try {
				try {
					const response = await fetch(`${SERVER_URL || ''}/docs/structure.json`)
					const structure = await response.json()
					setStructure(structure)
				} catch (e) {
					setError(e)
				}

				setLoading(false)
			} catch (err) {
				setError(err)
			}
		}

		fetchData()
	}, [])

	const iterateMenu = (s, path, depth) => {
		return (
			<Fragment>
				{loading ? (
					<div>loading..</div>
				) : (
					s.map((subsect) => (
						<Fragment key={subsect.label}>
							<div>
								<a
									href={`#${subsect.file || 'top'}`}
									style={{
										fontWeight: visibleFiles.includes(subsect.file) ? 'bold' : 'normal',
										color: visibleFiles.includes(subsect.file) ? 'rgb(213, 2, 21)' : '#555',
									}}
								>
									{subsect.label}
								</a>
							</div>
							{subsect.children && (
								<div style={style.menuChildren}>
									{iterateMenu(subsect.children, [...path, subsect.label], depth + 1)}
								</div>
							)}
						</Fragment>
					))
				)}
			</Fragment>
		)
	}

	const iterateContent = (s, path, depth) => {
		return (
			<Fragment>
				{s.map((subsect) => (
					<Fragment key={subsect.label}>
						<RenderSubsection
							subsect={subsect}
							path={path}
							depth={depth}
							setVisibleFiles={setVisibleFiles}
							visibleFiles={visibleFiles}
						/>
						{subsect.children && <div>{iterateContent(subsect.children, [...path, subsect.label], depth + 1)}</div>}
					</Fragment>
				))}
			</Fragment>
		)
	}

	return (
		<Fragment>
			<div style={style.header}>
				<div>
					<img src="/img/icons/48x48.png" alt="link icon" style={{ width: 72 / 2 }} />
				</div>
				<div style={style.headerText}>
					<strong>Bitfocus Companion</strong>
					<br />
					Documentation
				</div>
			</div>
			<div style={style.menuWrapper}>
				{error ? (
					<div style={{ backgroundColor: 'white' }}>{error}</div>
				) : (
					<>
						<div style={style.menuStructure}>
							<div style={{ padding: 20 }}>{iterateMenu(structure, [], 0)}</div>
						</div>
						<div style={style.contentWrapper} ref={contentWrapperRef} className="img-max-width">
							<div style={style.contentWrapper2}>
								<div anchor="#top"></div>
								{iterateContent(structure, [], 0)}
							</div>
						</div>
					</>
				)}
			</div>
		</Fragment>
	)
}

function RenderSubsection({ subsect, path, depth, setVisibleFiles, visibleFiles }) {
	return (
		<Fragment key={subsect.label}>
			{subsect.file && (
				<div style={{ marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
					<OnScreenReporter
						onChange={(visible) => {
							let updatedVisible
							if (visible) {
								updatedVisible = [...visibleFiles, subsect.file]
							} else {
								updatedVisible = visibleFiles.filter((f) => f !== subsect.file)
							}
							if (JSON.stringify(visible) !== JSON.stringify(updatedVisible)) {
								setVisibleFiles(updatedVisible)
							}
						}}
					>
						<h4 style={{ marginBottom: 15, paddingTop: 10 }} anchor={'#' + subsect.file}>
							{subsect.label}
						</h4>
						<a
							href={`https://github.com/bitfocus/companion/blob/master/docs/${subsect.file}`}
							target="_new"
							style={style.contentGithubLink}
						>
							{subsect.file} <img src="/img/link.png" alt="Link" style={style.imgLink} />
						</a>
						<div>
							<LoadContent file={subsect.file} />
						</div>
					</OnScreenReporter>
				</div>
			)}
		</Fragment>
	)
}

function LoadContent({ file }) {
	const [content, setContent] = useState(null)
	const [loading, setLoading] = useState(true)

	// strip filename
	const baseUrl = `${file}`.replace(/\/[^/]+$/, '/')

	useEffect(() => {
		const fetchContent = async () => {
			const response = await fetch(`${SERVER_URL || ''}/docs/${file}`)
			const text = await response.text()
			setContent(text)
			setLoading(false)
		}
		fetchContent()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div>
			{loading ? (
				'loading'
			) : (
				<ReactMarkdown
					transformImageUri={(src, alt, title) => {
						return `${SERVER_URL || ''}/docs/${baseUrl}${src}`
					}}
					children={content}
				/>
			)}
		</div>
	)
}

function OnScreenReporter({ children, onChange }) {
	const ref = useRef()
	const entry = useIntersectionObserver(ref, {})
	const isOnScreen = entry?.isIntersecting

	const [visible, setVisible] = useState(null)

	useEffect(() => {
		if (isOnScreen !== visible) {
			setVisible(isOnScreen)
			onChange(isOnScreen)
		}
	}, [visible, isOnScreen, onChange])

	return <div ref={ref}>{children}</div>
}
