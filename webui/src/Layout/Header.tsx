import React, { type ReactElement, useCallback, useContext } from 'react'
import {
	CHeader,
	CHeaderBrand,
	CHeaderNav,
	CNavItem,
	CNavLink,
	CHeaderToggler,
	CContainer,
	CDropdownToggle,
	CDropdown,
	CDropdownItem,
	CDropdownMenu,
	CDropdownDivider,
} from '@coreui/react'
import {
	faBars,
	// faCircle, // solid circle, if making the faCircleQuestion icon "opaque"
	faInfo,
	faStar,
	faExternalLinkSquare,
	faLock,
	faTriangleExclamation,
	faDollarSign,
} from '@fortawesome/free-solid-svg-icons'
import { faCircleQuestion, faCircle as faOpenCircle } from '@fortawesome/free-regular-svg-icons'
import { faSlack, faFacebook, faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { useSidebarState } from './Sidebar.js'
import { trpc } from '../Resources/TRPC.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { Link } from '@tanstack/react-router'

interface MyHeaderProps {
	canLock: boolean
	setLocked: (locked: boolean) => void
}

// provide a declarative menu specification:
interface MenuItem {
	readonly label: string
	readonly to: string | (() => void) // URL string or action callback
	readonly id?: string // used for key and to allow individually styled items, see code
	readonly icon?: IconDefinition | (() => ReactElement)
	readonly tooltip?: string
	readonly isExternal?: boolean
	readonly isSeparator?: boolean // currently, everything else is ignored if this is true
}

const MenuSeparator: MenuItem = {
	label: '',
	to: '',
	isSeparator: true,
}

// make our own circleInfo since it's not in the free FontAwesome offering (two options here)
function circleInfo(stacked = false): ReactElement {
	if (stacked) {
		return (
			<span className="fa-stack fa-2xs" style={{ marginLeft: '0.2em', marginRight: '-0.8em', marginTop: '-0.35em' }}>
				<FontAwesomeIcon icon={faOpenCircle} className="fa-stack-2x" style={{ marginLeft: '-0.45em' }} />
				<FontAwesomeIcon icon={faInfo} className="fa-stack-1x" style={{ marginLeft: '0.1em' }} />
			</span>
		)
	} else {
		return (
			<FontAwesomeIcon
				icon={faInfo}
				className="fa-xs"
				style={{
					border: '0.2em solid',
					borderRadius: '100%',
					padding: '0.15em 0.05em 0.35em 0.1em', // top right bottom left
					margin: '-0.05em 0em -0.45em -0.05em',
				}}
			/>
		)
	}
}

export const MyHeader = observer(function MyHeader({ canLock, setLocked }: MyHeaderProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const { showToggle, clickToggle } = useSidebarState()

	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())

	return (
		<CHeader position="sticky" className="p-0">
			<CContainer fluid>
				{showToggle && (
					<CHeaderToggler className="ps-1" onClick={clickToggle}>
						<FontAwesomeIcon icon={faBars} />
					</CHeaderToggler>
				)}
				<CHeaderBrand className="mx-auto d-md-none">
					Bitfocus&nbsp;<span style={{ fontWeight: 'bold' }}>Companion</span>
				</CHeaderBrand>

				<CHeaderNav className="d-none d-md-flex me-auto">
					{userConfig.properties?.installName && userConfig.properties?.installName.length > 0 && (
						<CNavItem className="install-name">{userConfig.properties?.installName}</CNavItem>
					)}

					{updateData.data?.message ? (
						<CNavItem className="header-notification-item">
							<CNavLink target="_blank" href={updateData.data.link || 'https://bitfocus.io/companion/'}>
								<div className="flex">
									<div className="align-self-center">
										<FontAwesomeIcon icon={faTriangleExclamation} className="header-update-icon" />
									</div>
									<div>
										{updateData.data.message}
										{!!updateData.data.message2 && (
											<>
												<br />
												{updateData.data.message2}
											</>
										)}
										<FontAwesomeIcon icon={faExternalLinkSquare} className="ms-2" />
									</div>
								</div>
							</CNavLink>
						</CNavItem>
					) : (
						''
					)}
				</CHeaderNav>

				<CHeaderNav className="ml-auto header-right">
					{canLock && (
						<CNavItem>
							<CNavLink onClick={() => setLocked(true)} title="Lock Admin UI">
								<FontAwesomeIcon icon={faLock} className="fa-lg" />
							</CNavLink>
						</CNavItem>
					)}
				</CHeaderNav>
				{/* Placing HelpMenu outside CHeaderNav gives "standard" menu line-heights. 
						Move it into the CHeaderNav block to make it look more like the sidebar line height.  */}
				<HelpMenu />
			</CContainer>
		</CHeader>
	)
})

function HelpMenu() {
	// We could add the config wizard (showWizard) to the help menu in this useContext...
	const { whatsNewModal } = useContext(RootAppStoreContext)
	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])

	// note: the definition has to be inside a component so that we can grab `whatsNewOpen` which is a useCallback...
	const helpMenuItems: MenuItem[] = [
		{
			id: 'user-guide',
			label: 'User Guide / Help',
			icon: circleInfo, // this is a function call, unlike the rest.
			to: '/user-guide/',
			tooltip: 'Open the User Guide in a new tab.',
			isExternal: true,
		},
		{
			id: 'whats-new',
			label: "What's New",
			icon: faStar,
			to: whatsNewOpen,
			tooltip: 'Show the current release notes.',
			isExternal: false,
		},
		MenuSeparator,
		{
			id: 'fb',
			label: 'Community Support',
			icon: faFacebook,
			to: 'https://bfoc.us/qjk0reeqmy',
			tooltip: 'Share your experience or ask questions to your Companions.',
			isExternal: true,
		},
		{
			id: 'slack',
			label: 'Slack Workspace',
			icon: faSlack,
			to: 'https://bfoc.us/ke7e9dqgaz',
			tooltip: 'Discuss technical issues on Slack.',
			isExternal: true,
		},
		{
			id: 'github',
			label: 'Report an Issue',
			icon: faGithub,
			to: 'https://bfoc.us/fiobkz0yqs',
			tooltip: 'Report bugs or request features on GitHub.',
			isExternal: true,
		},
		MenuSeparator,
		{
			id: 'donate',
			label: 'Donate',
			icon: faDollarSign,
			to: 'https://bfoc.us/ccfbf8wm2x',
			tooltip: 'Contribute funds to Bitfocus Companion.',
			isExternal: true,
		},
	]

	// technical detail: unlike the other elements, CDropdownToggle does not define a 'dropdown-toggle' CSS class,
	// but worse, if you add it manually, `caret={false}` is ignored, so it's named 'help-toggle' here.
	return (
		//note: without position-static, the menu doesn't show. Alternatively, set style={{position: 'inherit'}} or play with z-index
		<CDropdown className="position-static help-menu" offset={[10, 7]}>
			<CDropdownToggle color="primary" caret={false} className="help-toggle">
				<FontAwesomeIcon icon={faCircleQuestion} className="fa-2xl" />
			</CDropdownToggle>

			<CDropdownMenu>
				{helpMenuItems.map((option, idx) => (
					<MenuItem key={option.id || `item-${idx}`} data={option} />
				))}
			</CDropdownMenu>
		</CDropdown>
	)
}

// create menu-entries with (1) optional left-hand icon, (2) label, (3) optional right-side "external link" icon
// The menu action can be either a URL or a function call
function MenuItem({ data }: { data: MenuItem }) {
	if (data.isSeparator) {
		return <CDropdownDivider />
	} else {
		const isUrl = typeof data.to === 'string'
		const navProps = isUrl
			? { to: data.to, as: Link, rel: 'noopener noreferrer', target: data.isExternal ? '_blank' : '_self' }
			: { onClick: data.to }

		// Structure: [CDropdownItem [CNavLink [left-icon, text, right-icon ]]]
		return (
			// note: CDropdownItem has CSS class: dropdown-item. Here we only add the optional item-specific class
			<CDropdownItem as={isUrl ? 'div' : 'button'} className={data.id && `dropdown-item-${data.id}`}>
				<CNavLink {...navProps} className="d-flex justify-content-start" title={data.tooltip}>
					<span className="dropdown-item-icon">
						{typeof data.icon === 'function' ? (
							data.icon()
						) : (
							<FontAwesomeIcon
								icon={data.icon ? data.icon : faOpenCircle}
								className={data.icon ? 'visible' : 'invisible'}
							/>
						)}
					</span>

					<span className="dropdown-item-label">{data.label}</span>

					{data.isExternal ? <FontAwesomeIcon className="ms-auto" icon={faExternalLinkSquare} /> : ' '}
				</CNavLink>
			</CDropdownItem>
		)
	}
}
