import type { SectionDefinition } from './Sections'

interface SettingsNavProps {
	sections: readonly SectionDefinition[]
	activeId: string | null
	onSelect: (id: string) => void
}

/** The list of sections down the side of the settings window, marking the one scrolled to */
export function SettingsNav({ sections, activeId, onSelect }: SettingsNavProps): React.JSX.Element {
	return (
		<nav className="settings-nav" aria-label="Settings sections">
			<ul>
				{sections.map((section) => (
					<li key={section.id}>
						<a
							href={`#${section.id}`}
							aria-current={section.id === activeId ? 'true' : undefined}
							onClick={(e) => {
								e.preventDefault()
								onSelect(section.id)
							}}
						>
							{section.title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	)
}
