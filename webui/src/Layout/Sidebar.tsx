import React, { memo, useState } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import { CSidebar, CSidebarNav, CNavItem, CNavLink, CSidebarBrand, CSidebarToggler, CSidebarHeader, CNavGroup } from '@coreui/react'
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
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SURFACES_PAGE_PREFIX } from '../Surfaces/index.js'
import { BUTTONS_PAGE_PREFIX } from '../Buttons/index.js'
import { TRIGGERS_PAGE_PREFIX } from '../Triggers/index.js'

interface MySidebarProps {
	sidebarShow: boolean
}

const navItems = [
	{ name: 'Connections', icon: faPlug, path: '/connections' },
	{ name: 'Buttons', icon: faTh, path: BUTTONS_PAGE_PREFIX },
	{ name: 'Surfaces', icon: faGamepad, path: SURFACES_PAGE_PREFIX },
	{ name: 'Triggers', icon: faClock, path: TRIGGERS_PAGE_PREFIX },
	{ name: 'Variables', icon: faDollarSign, path: '/variables' },
	{ name: 'Settings', icon: faCog, path: '/settings' },
	{ name: 'Import / Export', icon: faFileImport, path: '/import-export' },
	{ name: 'Log', icon: faClipboardList, path: '/log' },
	{ name: 'Cloud', icon: faCloud, path: '/cloud', show: window.localStorage.getItem('show_companion_cloud') === '1' },
]

export const MySidebar = memo(function MySidebar({ sidebarShow }: MySidebarProps) {
	const [unfoldable, setUnfoldable] = useState(false)

	const routerLocation = useLocation()

	const isActive = (prefix: string) => routerLocation.pathname.startsWith(prefix + '/') || routerLocation.pathname === prefix

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
			<CSidebarNav>
				{navItems.filter((item) => item.show !== false).map((item) => (
					<CNavItem key={item.path}>
						<CNavLink to={item.path} active={isActive(item.path)} as={NavLink}>
							<FontAwesomeIcon className="nav-icon" icon={item.icon} /> {item.name}
						</CNavLink>
					</CNavItem>
				))}

				<CNavGroup
					toggler={
						<>
							<FontAwesomeIcon className="nav-icon" icon={faGamepad} /> Controls
						</>
					}
				>
					<CNavItem target="_new" href="/emulators">
						<span className="nav-icon">
							<span className="nav-icon-bullet" />
						</span>
						<div className="flex-fill">Emulator</div>
						<FontAwesomeIcon icon={faExternalLinkSquare} />
					</CNavItem>

					<CNavItem target="_new" href="/tablet">
						<span className="nav-icon">
							<span className="nav-icon-bullet" />
						</span>
						<div className="flex-fill">Web buttons</div>
						<FontAwesomeIcon icon={faExternalLinkSquare} />
					</CNavItem>
				</CNavGroup>
			</CSidebarNav>
			<CSidebarHeader className="border-top">
				<CSidebarToggler className="d-none d-lg-flex" onClick={() => setUnfoldable((val) => !val)} />
			</CSidebarHeader>
		</CSidebar>
	)
})
