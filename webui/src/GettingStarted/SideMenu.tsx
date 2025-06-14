import { ObservableSet } from 'mobx'
import React, { Fragment } from 'react'
import { DocsSection } from './GettingStarted.js'
import { observer } from 'mobx-react-lite'

const style = {
	menuChildren: {
		marginLeft: 3,
		borderLeft: '1px dotted gray',
		paddingLeft: 20,
		marginBottom: 10,
	} satisfies React.CSSProperties,
}

interface GettingStartedMenuProps {
	visibleFiles: ObservableSet<string>
	structure: DocsSection[]
}

export function GettingStartedMenu({ visibleFiles, structure }: GettingStartedMenuProps): React.JSX.Element {
	return (
		<>
			{structure.map((subsect) => (
				<Fragment key={subsect.label}>
					<div>
						<GettingStartedLink visibleFiles={visibleFiles} subsect={subsect} />
					</div>
					{subsect.children && (
						<div style={style.menuChildren}>
							<GettingStartedMenu visibleFiles={visibleFiles} structure={subsect.children} />
						</div>
					)}
				</Fragment>
			))}
		</>
	)
}

const GettingStartedLink = observer(function GettingStartedLink({
	visibleFiles,
	subsect,
}: {
	visibleFiles: ObservableSet<string>
	subsect: DocsSection
}) {
	const fileName = getFilenameForSection(subsect)

	return (
		<a
			href={`#${fileName}`}
			style={{
				fontWeight: visibleFiles.has(fileName) ? 'bold' : 'normal',
				color: visibleFiles.has(fileName) ? 'rgb(213, 2, 21)' : '#555',
			}}
		>
			{subsect.label}
		</a>
	)
})

// eslint-disable-next-line react-refresh/only-export-components
export function getFilenameForSection(section: DocsSection): string {
	return section.file || `${section.children?.[0]?.file || ''}_parent`
}
