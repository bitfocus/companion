import React, { memo } from 'react'
import { CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CSidebarMinimizer } from '@coreui/react'
import {
	faBug,
	faComments,
	faDollarSign,
	faGamepad,
	faHatWizard,
	faInfo,
	faTabletAlt,
	faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface MySidebarProps {
	show: boolean
	showWizard: () => void
}

export const MySidebar = memo(function MySidebar({ show, showWizard }: MySidebarProps) {
	return (
		<CSidebar show={show}>
			<CSidebarNav>
				<CSidebarBrand>
					<div className="c-sidebar-brand-full">
						<img src="/img/icons/48x48.png" height="30" alt="logo" />
						&nbsp; Bitfocus&nbsp;
						<span style={{ fontWeight: 'bold' }}>Companion</span>
					</div>
					<div className="c-sidebar-brand-minimized">
						<img src="/img/icons/48x48.png" height="42px" alt="logo" />
					</div>
				</CSidebarBrand>

				<CSidebarNavItem
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faHatWizard} />}
					name={'Configuration Wizard'}
					onClick={showWizard}
				/>
				<CSidebarNavItem
					target="_new"
					href="/emulators"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faGamepad} />}
					name={'Emulator'}
				/>

				<CSidebarNavItem
					target="_new"
					href="/tablet"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faTabletAlt} />}
					name={'Web buttons'}
				/>

				<CSidebarNavItem
					target="_new"
					href="https://github.com/bitfocus/companion/issues"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faBug} />}
					name={'Bugs & Features'}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://www.facebook.com/groups/companion/"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faUsers} />}
					name={'Facebook'}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://bitfocus.io/api/slackinvite"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faComments} />}
					name={'Slack Chat'}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://donorbox.org/bitfocus-opensource"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faDollarSign} />}
					name={'Donate'}
				/>

				<CSidebarNavItem
					target="_new"
					href="/getting-started"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faInfo} />}
					name={'Getting Started'}
				/>
			</CSidebarNav>
			<CSidebarMinimizer />
		</CSidebar>
	)
})
