import React from 'react'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar.js'
import { AppSidebar } from './AppSidebar'
import { SectionDefinitions } from './Sections'

export function Settings(): JSX.Element {
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
					{SectionDefinitions.map((section, i, arr) => {
						const SectionComponent = section.component
						return (
							<>
								<div key={section.id} id={section.id}>
									<h2 className="text-xl font-semibold">{section.title}</h2>
									<SectionComponent />
								</div>
								{arr.length > i + 1 && <hr />}
							</>
						)
					})}
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
