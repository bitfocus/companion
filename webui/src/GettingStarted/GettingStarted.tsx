import React, { Fragment, useEffect } from 'react'
import { useHash, useSize } from 'react-use'
import { useIntersectionObserver, useResizeObserver } from 'usehooks-ts'
import { useStickyScroller } from './useStickyScroller.js'
import { observable, ObservableSet, runInAction } from 'mobx'
import { getFilenameForSection, GettingStartedMenu } from './SideMenu.js'
import { DocsContent } from './DocsContent.js'

import docsStructure0 from '@docs/structure.json'
import { makeAbsolutePath } from '~/util.js'
const docsStructure: DocsSection[] = docsStructure0

export interface DocsSection {
	label: string
	file?: string
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
		// position: 'relative',
	} satisfies React.CSSProperties,
	imgLink: {
		width: 12,
		opacity: 0.3,
		marginTop: -2,
		marginLeft: 4,
	} satisfies React.CSSProperties,
}

export function GettingStarted(): React.JSX.Element {
	const [hash] = useHash()

	const { scrollerElementRef, scrollerContentRef, handleScroll, restoreScroll } = useStickyScroller(hash)
	// Restore the scroll position when the data updates
	useEffect(() => restoreScroll(), [restoreScroll, hash])
	// Restore the scroll position when the scroller resizes
	useResizeObserver({
		ref: scrollerContentRef,
		onResize: restoreScroll,
	})

	// Follow any changes to the hash
	useEffect(() => {
		setTimeout(() => {
			if (scrollerElementRef.current) {
				// scroll to hash
				const el = scrollerElementRef.current.querySelector(`[data-anchor="${hash}"]`)
				if (el) {
					el.scrollIntoView({ behavior: 'smooth' })
				}
			}
		}, 50)
	}, [scrollerElementRef, hash])

	const visibleFiles = observable.set<string>()

	const iterateContent = (s: DocsSection[]) => {
		return s.map((subsect) => (
			<Fragment key={subsect.label}>
				<RenderSubsection subsect={subsect} visibleFiles={visibleFiles} triggerScroll={restoreScroll} />
				{subsect.children && iterateContent(subsect.children)}
			</Fragment>
		))
	}

	return (
		<Fragment>
			<div style={style.header}>
				<div>
					<img src={makeAbsolutePath('/img/icons/48x48.png')} alt="link icon" style={{ width: 72 / 2 }} />
				</div>
				<div style={style.headerText}>
					<strong>Bitfocus Companion</strong>
					<br />
					Documentation
				</div>
			</div>
			<div style={style.menuWrapper}>
				<>
					<div style={style.menuStructure}>
						<div style={{ padding: 20 }}>
							<GettingStartedMenu visibleFiles={visibleFiles} structure={docsStructure} />
						</div>
					</div>
					<div style={style.contentWrapper} ref={scrollerElementRef} onScroll={handleScroll} className="img-max-width">
						<div style={style.contentWrapper2} ref={scrollerContentRef}>
							<div data-anchor="#top"></div>
							{iterateContent(docsStructure)}
						</div>
					</div>
				</>
			</div>
		</Fragment>
	)
}

interface RenderSubsectionProps {
	subsect: DocsSection
	visibleFiles: ObservableSet<string>
	triggerScroll: () => void
}
function RenderSubsection({ subsect, visibleFiles, triggerScroll }: RenderSubsectionProps) {
	const fileName = getFilenameForSection(subsect)

	const [content, { height }] = useSize(
		<div style={subsect.file ? { marginBottom: 30, paddingBottom: 20, borderBottom: '1px solid #eee' } : {}}>
			<OnScreenReporter visibleFiles={visibleFiles} file={fileName}>
				{subsect.file && (
					<>
						<a
							href={`https://github.com/bitfocus/companion/blob/main/docs/${subsect.file}`}
							target="_blank"
							style={style.contentGithubLink}
						>
							{subsect.file} <img src={makeAbsolutePath('/img/link.png')} alt="Link" style={style.imgLink} />
						</a>
						<div>
							<DocsContent file={subsect.file} />
						</div>
					</>
				)}
			</OnScreenReporter>
		</div>,
		{ width: 0, height: 0 }
	)

	// When the height changes, check the scroll position
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => triggerScroll(), [height])

	return (
		<Fragment key={subsect.label}>
			<h4 style={{ marginBottom: 15, paddingTop: 10 }} data-anchor={'#' + fileName}>
				{subsect.label}
			</h4>
			{content}
		</Fragment>
	)
}

interface OnScreenReporterProps {
	visibleFiles: ObservableSet<string>
	file: string
}
function OnScreenReporter({ children, visibleFiles, file }: React.PropsWithChildren<OnScreenReporterProps>) {
	const { ref } = useIntersectionObserver({
		onChange: (isVisible) => {
			runInAction(() => {
				if (isVisible) {
					visibleFiles.add(file)
				} else {
					visibleFiles.delete(file)
				}
			})
		},
	})

	return <div ref={ref}>{children}</div>
}
