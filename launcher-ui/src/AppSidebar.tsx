import { CogIcon } from 'lucide-react'
import React from 'react'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '~/components/ui/sidebar.js'
import { SectionDefinitions } from './Sections'
import { useSectionVisibility } from './contexts/SectionVisibilityContext'

export function AppSidebar(): JSX.Element {
	const { activeSectionId } = useSectionVisibility()

	return (
		<Sidebar>
			<SidebarHeader>
				<span className="flex flex-row gap-2">
					<CogIcon className="h-6 w-6" />
					Advanced Settings
				</span>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					{/* <SidebarGroupLabel>{item.title}</SidebarGroupLabel> */}
					<SidebarGroupContent>
						<SidebarMenu>
							{SectionDefinitions.map((item) => (
								<SidebarMenuItem key={item.id}>
									<SidebarMenuButton asChild isActive={activeSectionId === item.id}>
										<a href={`#${item.id}`}>{item.title}</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	)
}
