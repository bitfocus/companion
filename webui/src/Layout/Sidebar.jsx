import React from 'react'
import { CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand } from '@coreui/react'
import { faBug, faComments, faDollarSign, faGamepad, faInfo, faMousePointer, faTabletAlt, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslation } from 'react-i18next'

export function MySidebar() {
	const { t } = useTranslation();

	return (
		<CSidebar>
			<CSidebarNav>
				<CSidebarBrand></CSidebarBrand>

				<CSidebarNavItem target="_new" href="/emulator.html" icon={<FontAwesomeIcon icon={faGamepad} />} name={t("Emulator")} />
				<CSidebarNavItem target="_new" href="/tablet.html" icon={<FontAwesomeIcon icon={faMousePointer} />} name={t("Web buttons")} />
				<CSidebarNavItem target="_new" href="/tablet2.html" icon={<FontAwesomeIcon icon={faTabletAlt} />} name={t("Mobile buttons")} />

				<CSidebarNavItem target="_new" href="https://github.com/bitfocus/companion/issues" icon={<FontAwesomeIcon icon={faBug} />} name={t("Bugs & Features")} />
				<CSidebarNavItem target="_new" href="https://www.facebook.com/groups/companion/" icon={<FontAwesomeIcon icon={faUsers} />} name={t("Facebook")} />
				<CSidebarNavItem target="_new" href="https://join.slack.com/t/bitfocusio/shared_invite/enQtODk4NTYzNTkzMjU1LTMzZDY1Njc2MmE3MzVlNmJhMTBkMzFjNTQ2NzZlYzQyZWIzZTJkZWIyNmJlY2U0NzM1NGEzNzNlZWY3OWJlNGE" icon={<FontAwesomeIcon icon={faComments} />} name={t("Slack Chat")} />
				<CSidebarNavItem target="_new" href="https://donorbox.org/bitfocus-opensource" icon={<FontAwesomeIcon icon={faDollarSign} />} name={t("Donate")} />

				<CSidebarNavItem target="_new" href="/help.html" icon={<FontAwesomeIcon icon={faInfo} />} name={t("Getting Started")} />
			</CSidebarNav>
		</CSidebar>
	)
}
