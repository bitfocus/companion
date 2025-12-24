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
	// faCircle, // if backing the faCircleQuestion icon
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
interface MenuOption {
	readonly value: string
	readonly label: string
	readonly icon?: IconDefinition | (() => ReactElement)
	readonly destination: string | (() => void)
	readonly tooltip?: string
	readonly isExternal?: boolean
	readonly isSeparator?: boolean
}

const MenuSeparator: MenuOption = {
	value: '',
	label: '',
	destination: '',
	isSeparator: true,
}

// make our own circleInfo since it's not in the free FontAwesome offering
function circleInfo(stacked = false): ReactElement {
	return stacked ? (
		<span className="fa-stack fa-2xs" style={{ marginRight: '-0.75em', marginTop: '-0.2em' }}>
			<FontAwesomeIcon icon={faOpenCircle} className="fa-stack-2x" style={{ marginLeft: '-0.45em' }} />
			<FontAwesomeIcon icon={faInfo} className="fa-stack-1x" style={{ marginLeft: '0.1em' }} />
		</span>
	) : (
		<FontAwesomeIcon
			icon={faInfo}
			className="fa-xs"
			style={{
				border: '0.2em solid',
				borderRadius: '100%',
				padding: '0.15em 0.05em 0.35em 0.05em', // top right bottom left
				marginBottom: '-0.45em',
			}}
		/>
	)
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
						<CNavItem className="header-nav-item">
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

					<HelpMenu />
				</CHeaderNav>
			</CContainer>
		</CHeader>
	)
})

function HelpMenu({ ...props }) {
	// we could add the config wizard here too?
	const { whatsNewModal } = useContext(RootAppStoreContext)
	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])

	// specifying this inline below, causes a spurious TypeScript error message on '--cui-dropdown-link-hover-bg'
	const menuStyle = {
		backgroundColor: 'var(--cui-header-bg)',
		// note: hover color is controlled by `.header .nav-link:hover` in _layout.scss
		'--cui-dropdown-link-hover-bg': 'var(--companion-header-brand-bg)',
		padding: 0,
	}

	// note: this const has to be inside the component so that we can grab `whatsNewOpen` which is a useCallback...
	const helpMenuOptions: MenuOption[] = [
		{
			value: 'help',
			label: 'User Guide / Help',
			icon: circleInfo,
			destination: '/user-guide/',
			tooltip: 'Open the User Guide in a new tab.',
			isExternal: true,
		},
		{
			value: 'new',
			label: "What's New",
			icon: faStar,
			destination: whatsNewOpen,
			tooltip: 'Show the current release notes.',
			isExternal: false,
		},
		MenuSeparator,
		{
			value: 'fb',
			label: 'Community Support',
			icon: faFacebook,
			destination: 'https://bfoc.us/qjk0reeqmy',
			tooltip: 'Share your experience or ask questions to your Companions.',
			isExternal: true,
		},
		{
			value: 'slack',
			label: 'Slack Workspace',
			icon: faSlack,
			destination: 'https://bfoc.us/ke7e9dqgaz',
			tooltip: 'Discuss technical issues on Slack.',
			isExternal: true,
		},
		{
			value: 'github',
			label: 'Report an Issue',
			icon: faGithub,
			destination: 'https://bfoc.us/fiobkz0yqs',
			tooltip: 'Report bugs or request features on GitHub.',
			isExternal: true,
		},
		MenuSeparator,
		{
			value: 'donate',
			label: 'Donate',
			icon: faDollarSign,
			destination: 'https://bfoc.us/ccfbf8wm2x',
			tooltip: 'Contribute funds to Bitfocus Companion.',
			isExternal: true,
		},
	]

	return (
		<CDropdown
			{...props}
			className=""
			offset={[10, 7]}
			style={{
				//without the next line, the menu doesn't show:
				position: 'inherit',
			}}
		>
			<CDropdownToggle
				color="primary"
				caret={false}
				style={{
					// this is all needed to make the focus/hover-highlight round and just slightly larger than the icon
					padding: '0.2em 0',
					marginLeft: '1em',
					borderRadius: '100%',
				}}
			>
				<FontAwesomeIcon icon={faCircleQuestion} className="fa-2xl" />
			</CDropdownToggle>
			<CDropdownMenu style={menuStyle}>
				{helpMenuOptions.map((option) => (
					<MenuItem key={option.value} data={option} {...props} />
				))}
			</CDropdownMenu>
		</CDropdown>
	)
}

// create menu-entries with (1) optional left-hand icon, (2) label, (3) optional right-side "external link" icon
function MenuItem({ data, ...props }: { data: MenuOption }) {
	const isUrl = typeof data.destination === 'string'
	const navProps = isUrl
		? { to: data.destination, as: Link, rel: 'noopener noreferrer', target: data.isExternal ? '_blank' : '_self' }
		: { onClick: data.destination }

	// Structure: [CDropdownItem [CNavLink [left-icon, text, right-icon ]]] (or separator)
	return data.isSeparator ? (
		<CDropdownDivider
			style={{
				borderTop: '1px solid #888',
				margin: '0px 5px',
			}}
		/>
	) : (
		<CDropdownItem as={isUrl ? 'div' : 'button'} style={{ paddingLeft: 0, paddingRight: 5 }}>
			<CNavLink {...navProps} title={data.tooltip}>
				<span
					{...props}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<span style={{ paddingLeft: '0.5em' }}>
						{typeof data.icon === 'function' ? (
							data.icon()
						) : (
							<FontAwesomeIcon
								icon={data.icon ? data.icon : faInfo}
								style={{ visibility: data.icon ? 'inherit' : 'hidden' }}
							/>
						)}
						<span style={{ paddingRight: '1em', paddingLeft: '1em' }}>{data.label}</span>
					</span>

					{data.isExternal ? <FontAwesomeIcon icon={faExternalLinkSquare} /> : ' '}
				</span>
			</CNavLink>
		</CDropdownItem>
	)
}
