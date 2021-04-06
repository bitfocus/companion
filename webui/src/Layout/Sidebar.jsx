import React from 'react'
import { CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CSidebarMinimizer } from '@coreui/react'
import {
	faBug,
	faComments,
	faDollarSign,
	faGamepad,
	faInfo,
	faMousePointer,
	faTabletAlt,
	faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslation } from 'react-i18next'

export function MySidebar({ show }) {
	const { t } = useTranslation()

	return (
		<CSidebar show={show}>
			<CSidebarNav>
				<CSidebarBrand>
					<div className="c-sidebar-brand-full">
						<img src="/img/brand/icon.png" height="30" alt="logo" />
						&nbsp; Bitfocus&nbsp;
						<span style={{ fontWeight: 'bold' }}>Companion</span>
					</div>
					<div className="c-sidebar-brand-minimized">
						<img src="/img/brand/icon.png" height="42px" alt="logo" />
					</div>
				</CSidebarBrand>

				<CSidebarNavItem
					target="_new"
					href="/emulator"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faGamepad} />}
					name={t('Emulator')}
				/>
				<CSidebarNavItem
					target="_new"
					href="/tablet.html"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faMousePointer} />}
					name={t('Web buttons')}
				/>
				<CSidebarNavItem
					target="_new"
					href="/tablet2.html"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faTabletAlt} />}
					name={t('Mobile buttons')}
				/>
				<CSidebarNavItem
					target="_new"
					href="/tablet3"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faTabletAlt} />}
					name={t('New Web/Mobile buttons')}
				/>

				<CSidebarNavItem
					target="_new"
					href="https://github.com/bitfocus/companion/issues"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faBug} />}
					name={t('Bugs & Features')}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://www.facebook.com/groups/companion/"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faUsers} />}
					name={t('Facebook')}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://join.slack.com/t/bitfocusio/shared_invite/enQtODk4NTYzNTkzMjU1LTMzZDY1Njc2MmE3MzVlNmJhMTBkMzFjNTQ2NzZlYzQyZWIzZTJkZWIyNmJlY2U0NzM1NGEzNzNlZWY3OWJlNGE"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faComments} />}
					name={t('Slack Chat')}
				/>
				<CSidebarNavItem
					target="_new"
					href="https://donorbox.org/bitfocus-opensource"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faDollarSign} />}
					name={t('Donate')}
				/>

				<CSidebarNavItem
					target="_new"
					href="/getting-started"
					icon={<FontAwesomeIcon className="c-sidebar-nav-icon" icon={faInfo} />}
					name={t('Getting Started')}
				/>
			</CSidebarNav>
			<CSidebarMinimizer />
		</CSidebar>
	)
}
