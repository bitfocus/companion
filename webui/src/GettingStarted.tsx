import React, { Fragment, useRef, useState, useEffect } from 'react'
import { useHash } from 'react-use'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useIntersectionObserver } from 'usehooks-ts'

interface DocsSection {
	label: string
	file: string
	children?: DocsSection[]
}

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
	} satisfies React.CSSProperties,
	headerText: {
		lineHeight: '1.1em',
		marginTop: 4,
		marginLeft: 5,
	} satisfies React.CSSProperties,
	menuWrapper: {
		backgroundColor: 'white',
		display: 'flex',
		zIndex: 1,
	} satisfies React.CSSProperties,
	menuStructure: {
		width: '20vw',
		minWidth: 250,
		height: 'calc(100vh - 50px)',
		overflow: 'scroll',
		zIndex: 200,
		boxShadow: '-15px 2px 31px 22px rgba(100,100,100,0.1)',
	} satisfies React.CSSProperties,
	contentGithubLink: {
		backgroundColor: '#f0f0f0',
		display: 'inline-block',
		borderRadius: 4,
		fontSize: 10,
		color: '#999',
		padding: '2px 5px',
		clear: 'both',
		float: 'right',
	} satisfies React.CSSProperties,
	contentWrapper: {
		width: '80vw',
		maxWidth: 'calc(100vw - 250px)',
		height: 'calc(100vh - 50px)',
		overflow: 'scroll',
		backgroundColor: 'white',
		zIndex: 100,
		padding: 20,
		paddingLeft: 40,
	} satisfies React.CSSProperties,
	contentWrapper2: {
		maxWidth: 1200,
	} satisfies React.CSSProperties,
	menuChildren: {
		marginLeft: 3,
		borderLeft: '1px dotted gray',
		paddingLeft: 20,
		marginBottom: 10,
	} satisfies React.CSSProperties,
	imgLink: {
		width: 12,
		opacity: 0.3,
		marginTop: -2,
		marginLeft: 4,
	} satisfies React.CSSProperties,
}

export function GettingStarted() {
	const [hash] = useHash()
	const contentWrapperRef = useRef<HTMLDivElement>(null)
	const [structure, setStructure] = useState([])
	const [error, setError] = useState(null)
	const [loading, setLoading] = useState(true)
	const [visibleFiles, setVisibleFiles] = useState<string[]>([])

	useEffect(() => {
		setTimeout(() => {
			if (contentWrapperRef.current) {
				// scroll to hash
				const el = contentWrapperRef.current.querySelector(`[data-anchor="${hash}"]`)
				if (el) {
					el.scrollIntoView({ behavior: 'smooth' })
				}
			}
		}, 50)
	}, [contentWrapperRef, hash])

	// Fetch /docs/structure.json and parse it
	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await fetch(`/docs/structure.json`)
				const structure = await response.json()
				setStructure(structure)
			} catch (e: any) {
				setError(e)
			}

			setLoading(false)
		}

		fetchData()
	}, [])

	const iterateMenu = (s: DocsSection[], path: string[], depth: number) => {
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

	const iterateContent = (s: DocsSection[], path: string[], depth: number) => {
		return (
			<Fragment>
				{s.map((subsect) => (
					<Fragment key={subsect.label}>
						<RenderSubsection subsect={subsect} setVisibleFiles={setVisibleFiles} visibleFiles={visibleFiles} />
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
								<div data-anchor="#top"></div>
								{iterateContent(structure, [], 0)}
							</div>
						</div>
					</>
				)}
			</div>
		</Fragment>
	)
}

interface RenderSubsectionProps {
	subsect: DocsSection
	setVisibleFiles: (visibleFiles: string[]) => void
	visibleFiles: string[]
}
function RenderSubsection({ subsect, setVisibleFiles, visibleFiles }: RenderSubsectionProps) {
	return (
		<Fragment key={subsect.label}>
			{subsect.file && (
				<div style={{ marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
					<OnScreenReporter
						onChange={(visible) => {
							const updatedVisible = visible
								? [...visibleFiles, subsect.file].filter((f): f is string => !!f)
								: visibleFiles.filter((f) => f !== subsect.file)

							if (JSON.stringify(visible) !== JSON.stringify(updatedVisible)) {
								setVisibleFiles(updatedVisible)
							}
						}}
					>
						<h4 style={{ marginBottom: 15, paddingTop: 10 }} data-anchor={'#' + subsect.file}>
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

interface LoadContentProps {
	file: string
}
function LoadContent({ file }: LoadContentProps) {
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(true)

	// strip filename
	const baseUrl = `${file}`.replace(/\/[^/]+$/, '/')

	useEffect(() => {
		const fetchContent = async () => {
			const response = await fetch(`/docs/${file}`)
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
					transformImageUri={(src, _alt, _title) => {
						return `/docs/${baseUrl}${src}`
					}}
					children={content}
					remarkPlugins={[remarkGfm]}
				/>
			)}
		</div>
	)
}

interface OnScreenReporterProps {
	onChange: (isOnScreen: boolean) => void
}
function OnScreenReporter({ children, onChange }: React.PropsWithChildren<OnScreenReporterProps>) {
	const ref = useRef<HTMLDivElement>(null)
	const entry = useIntersectionObserver(ref, {})
	const isOnScreen = entry?.isIntersecting ?? false

	const [visible, setVisible] = useState<boolean | null>(null)

	useEffect(() => {
		if (isOnScreen !== visible) {
			setVisible(isOnScreen)
			onChange(isOnScreen)
		}
	}, [visible, isOnScreen, onChange])

	return <div ref={ref}>{children}</div>
}
