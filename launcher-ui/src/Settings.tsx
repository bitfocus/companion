import React, { useEffect } from 'react'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar.js'
import { AppSidebar } from './AppSidebar'
import { SectionDefinitions } from './Sections'
import { SectionVisibilityProvider, useSectionVisibility } from './contexts/SectionVisibilityContext'
import { useSectionVisibilityObserver } from './hooks/useSectionVisibilityObserver'

function SectionWithObserver({
	section,
}: {
	section: { id: string; title: string; component: React.ComponentType }
}): JSX.Element {
	const SectionComponent = section.component
	const sectionRef = useSectionVisibilityObserver({ sectionId: section.id })

	return (
		<div id={section.id} ref={sectionRef}>
			<h2 className="text-xl font-semibold">{section.title}</h2>
			<SectionComponent />
		</div>
	)
}

function SettingsContent(): JSX.Element {
	const { setSectionOrder } = useSectionVisibility()

	useEffect(() => {
		// Set the section order when component mounts
		const order = SectionDefinitions.map((section) => section.id)
		setSectionOrder(order)
	}, [setSectionOrder])

	return (
		<SidebarProvider>
			<AppSidebar />

			<SidebarInset>
				{/* <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					Something
				</header> */}
				<div className="flex flex-1 flex-col gap-4 p-4">
					{/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
					</div>
					<div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" /> */}
					{SectionDefinitions.map((section, i, arr) => (
						<React.Fragment key={section.id}>
							<SectionWithObserver section={section} />
							{arr.length > i + 1 && <hr />}
						</React.Fragment>
					))}
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}

export function Settings(): JSX.Element {
	return (
		<SectionVisibilityProvider>
			<SettingsContent />
		</SectionVisibilityProvider>
	)
}
