import React from 'react'
import { Separator } from '~/components/ui/separator'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from '~/components/ui/sidebar.js'

// This is sample data.
const data = {
	navMain: [
		{
			title: 'Getting Started',
			url: '#',
			items: [
				{
					title: 'Installation',
					url: '#',
				},
				{
					title: 'Project Structure',
					url: '#',
				},
			],
		},
	],
}

export function Settings(): JSX.Element {
	return (
		<SidebarProvider>
			<Sidebar>
				<SidebarHeader>Heading here</SidebarHeader>
				<SidebarContent>
					{/* We create a SidebarGroup for each parent. */}
					{data.navMain.map((item) => (
						<SidebarGroup key={item.title}>
							<SidebarGroupLabel>{item.title}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{item.items.map((item) => (
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton asChild isActive={item.isActive}>
												<a href={item.url}>{item.title}</a>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>
			</Sidebar>

			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					Something
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<div className="grid auto-rows-min gap-4 md:grid-cols-3">
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
					</div>
					<div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
