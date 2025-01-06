import React, { useCallback } from 'react'
import { CNav, CNavItem } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBug, faComments, faDollarSign, faHatWizard, faInfo, faUsers } from '@fortawesome/free-solid-svg-icons'

interface FooterProps {
	showWizard: () => void
}

export function Footer({ showWizard }: FooterProps) {
	const onClickWizard = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			e.preventDefault()

			showWizard()
		},
		[showWizard]
	)

	const navItems = [
		{ name: 'Configuration Wizard', icon: faHatWizard, href: "#", onClick: onClickWizard },
		{ name: 'Bugs & Features', icon: faBug, href: 'https://github.com/bitfocus/companion/issues', target: '_new' },
		{ name: 'Facebook', icon: faUsers, href: 'https://www.facebook.com/groups/companion/', target: '_new' },
		{ name: 'Slack Chat', icon: faComments, href: 'https://bitfocus.io/api/slackinvite', target: '_new' },
		{ name: 'Donate', icon: faDollarSign, href: 'https://donorbox.org/bitfocus-opensource', target: '_new' },
		{ name: 'Getting Started', icon: faInfo, href: '/getting-started' },
	]

	return (
		<CNav className="footer-nav">
			{navItems.map((item) => (
				<CNavItem key={item.name} href={item.href} target={item.target} onClick={item.onClick}>
					<FontAwesomeIcon className="nav-icon" icon={item.icon} /> {item.name}
				</CNavItem>
			))}
		</CNav>
	)
}
