import React, { memo, useState } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import {
	CSidebar,
	CSidebarNav,
	CNavItem,
	CNavLink,
	CSidebarBrand,
	CSidebarToggler,
	CSidebarHeader,
	CNavGroup,
} from '@coreui/react'
import {
	faFileImport,
	faCog,
	faClipboardList,
	faCloud,
	faTh,
	faClock,
	faPlug,
	faDollarSign,
	faGamepad,
	faExternalLinkSquare,
	faQuestionCircle,
	faBug,
	faUsers,
	faComments,
	IconDefinition,
	faSquareCaretRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SURFACES_PAGE_PREFIX } from '../Surfaces/index.js'
import { BUTTONS_PAGE_PREFIX } from '../Buttons/index.js'
import { TRIGGERS_PAGE_PREFIX } from '../Triggers/index.js'
import { SurfacesTabNotifyIcon } from '../Surfaces/TabNotifyIcon.js'

type NavItem = {
	name: string
	icon: IconDefinition
	notifications?: React.ComponentType<Record<string, never>>
	path?: string
	show?: boolean
	dropdown?: { name: string; icon?: IconDefinition; path: string; target?: string }[]
}

const primaryNavItems: NavItem[] = [
	{ name: 'Connections', icon: faPlug, path: '/connections' },
	{ name: 'Buttons', icon: faTh, path: BUTTONS_PAGE_PREFIX },
	{ name: 'Surfaces', icon: faGamepad, path: SURFACES_PAGE_PREFIX, notifications: SurfacesTabNotifyIcon },
	{ name: 'Triggers', icon: faClock, path: TRIGGERS_PAGE_PREFIX },
	{ name: 'Variables', icon: faDollarSign, path: '/variables' },
	{ name: 'Settings', icon: faCog, path: '/settings' },
	{ name: 'Import / Export', icon: faFileImport, path: '/import-export' },
	{ name: 'Log', icon: faClipboardList, path: '/log' },
	{ name: 'Cloud', icon: faCloud, path: '/cloud', show: window.localStorage.getItem('show_companion_cloud') === '1' },
	{
		name: 'Interactive Buttons',
		icon: faSquareCaretRight,
		dropdown: [
			{ name: 'Emulator', path: '/emulators', target: '_new' },
			{ name: 'Web buttons', path: '/tablet', target: '_new' },
		],
	},
]

const secondaryNavItems: NavItem[] = [
	{
		name: 'Help & Community',
		icon: faQuestionCircle,
		dropdown: [
			{ name: 'Bugs & Features', icon: faBug, path: 'https://github.com/bitfocus/companion/issues', target: '_new' },
			{ name: 'Facebook', icon: faUsers, path: 'https://www.facebook.com/groups/companion/', target: '_new' },
			{ name: 'Slack Chat', icon: faComments, path: 'https://bitfocus.io/api/slackinvite', target: '_new' },
			{ name: 'Donate', icon: faDollarSign, path: 'https://donorbox.org/bitfocus-opensource', target: '_new' },
		],
	},
]

interface MenuProps extends React.HTMLAttributes<HTMLElement> {
	navItems: NavItem[]
}

function SidebarMenu({ navItems, className }: MenuProps) {
	const routerLocation = useLocation()

	const isActive = (prefix: string) =>
		routerLocation.pathname.startsWith(prefix + '/') || routerLocation.pathname === prefix

	const subItemIconOrDefault = (icon?: IconDefinition) =>
		icon ? (
			<FontAwesomeIcon className="nav-icon" icon={icon} />
		) : (
			<span className="nav-icon">
				<span className="nav-icon-bullet" />
			</span>
		)

	return (
		<CSidebarNav className={className}>
			{navItems
				.filter((item) => item.show !== false)
				.map((item) =>
					item.path ? (
						<CNavItem key={item.path}>
							<CNavLink to={item.path} active={isActive(item.path)} as={NavLink}>
								<FontAwesomeIcon className="nav-icon" icon={item.icon} />
								<span className="flex-fill">{item.name}</span>
								{!!item.notifications && <item.notifications />}
							</CNavLink>
						</CNavItem>
					) : (
						<CNavGroup
							key={item.name}
							toggler={
								<>
									<FontAwesomeIcon className="nav-icon" icon={item.icon} />
									<span className="flex-fill">{item.name}</span>
									{!!item.notifications && <item.notifications />}
								</>
							}
						>
							{item.dropdown?.map((subItem) => (
								<CNavItem key={subItem.path} target={subItem.target} href={subItem.path}>
									{subItemIconOrDefault(subItem.icon)}
									<div className="flex-fill">{subItem.name}</div>
									{subItem.target === '_new' && <FontAwesomeIcon icon={faExternalLinkSquare} />}
								</CNavItem>
							))}
						</CNavGroup>
					)
				)}
		</CSidebarNav>
	)
}

interface MySidebarProps {
	sidebarShow: boolean
}

export const MySidebar = memo(function MySidebar({ sidebarShow }: MySidebarProps) {
	const [unfoldable, setUnfoldable] = useState(false)

	return (
		<CSidebar position="fixed" unfoldable={unfoldable} visible={sidebarShow} colorScheme="dark">
			<CSidebarHeader className="brand">
				<CSidebarBrand>
					<div className="sidebar-brand-full">
						<img src="/img/icons/48x48.png" height="30" alt="logo" />
						&nbsp; Bitfocus&nbsp;
						<span style={{ fontWeight: 'bold' }}>Companion</span>
					</div>
					<div className="sidebar-brand-narrow">
						<img src="/img/icons/48x48.png" height="42px" alt="logo" />
					</div>
				</CSidebarBrand>
			</CSidebarHeader>
			<SidebarMenu navItems={primaryNavItems} />
			<SidebarMenu navItems={secondaryNavItems} className="nav-secondary" />
			<CSidebarHeader className="border-top">
				<CSidebarToggler className="d-none d-lg-flex" onClick={() => setUnfoldable((val) => !val)} />
			</CSidebarHeader>
		</CSidebar>
	)
})
