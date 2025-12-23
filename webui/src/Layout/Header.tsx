import React, { type ReactElement, useCallback, useContext } from 'react'
import { CHeader, CHeaderBrand, CHeaderNav, CNavItem, CNavLink, CHeaderToggler, CContainer } from '@coreui/react'
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
import Select, {
	components as SelectComponents,
	type DropdownIndicatorProps,
	type OptionProps,
	// type ControlProps,
	// type ValueContainerProps,
	// type InputActionMeta,
} from 'react-select'

interface MyHeaderProps {
	canLock: boolean
	setLocked: (locked: boolean) => void
}
interface MenuOption {
	readonly value: string
	readonly label: string
	readonly icon?: IconDefinition | (() => ReactElement)
	readonly destination?: string
	readonly tooltip?: string
	readonly isExternal?: boolean
	readonly newSection?: boolean
	readonly isFixed?: boolean
	readonly isDisabled?: boolean
}

function circleInfo(stacked = false): ReactElement {
	return stacked ? (
		<span className="fa-stack fa-sm">
			<FontAwesomeIcon icon={faOpenCircle} className="fa-stack-2x" style={{ marginLeft: '-0.55em' }} />
			<FontAwesomeIcon icon={faInfo} className="fa-stack-1x" style={{ marginLeft: '0.1em' }} />
		</span>
	) : (
		<FontAwesomeIcon
			icon={faInfo}
			className="fa-sm"
			style={{
				border: '0.2em, solid, #fff',
				borderRadius: '100%',
				padding: '0.15em 0.05em 0.35em 0.05em', // top right bottom left
				marginBottom: '-0.45em',
				marginLeft: '-0.15em',
				marginRight: '0.35em',
			}}
		/>
	)
}

const helpMenuOptions: MenuOption[] = [
	{
		value: 'help',
		label: 'User Guide',
		icon: circleInfo,
		destination: '/user-guide/',
		tooltip: 'Open the User Guide in a new tab.',
		isExternal: true,
	},
	{
		value: 'new',
		label: "What's New",
		icon: faStar,
		destination: 'whatsNewOpen',
		tooltip: 'Show the current release notes.',
		isExternal: false,
	},
	{
		newSection: true,
		value: 'fb',
		label: 'Community Support',
		icon: faFacebook,
		destination: 'https://bfoc.us/qjk0reeqmy',
		tooltip: 'Share you experience or ask questions to your Companions.',
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
	{
		newSection: true,
		value: 'donate',
		label: 'Donate',
		icon: faDollarSign,
		destination: 'https://bfoc.us/ccfbf8wm2x',
		tooltip: 'Contribute funds to Bitfocus Companion.',
		isExternal: true,
	},
]

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
								<FontAwesomeIcon icon={faLock} className="fa-lg" style={{ paddingTop: '0.3em' }} />
							</CNavLink>
						</CNavItem>
					)}

					<HelpMenu menuOptions={helpMenuOptions} />
				</CHeaderNav>
			</CContainer>
		</CHeader>
	)
})

// Help menu
function HelpMenu({ menuOptions }: { menuOptions: MenuOption[] }) {
	// we could add the config wizard here too?
	// couldn't figure out how to make this an external function so we don't rely on a magic string in the menuOption
	const { whatsNewModal } = useContext(RootAppStoreContext)
	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])

	// The "circleQuestion" icon that shows in the header:
	const HelpIconIndicator = (props: DropdownIndicatorProps<MenuOption>) => (
		<SelectComponents.DropdownIndicator {...props}>
			<FontAwesomeIcon icon={faCircleQuestion} className="fa-2xl" />
		</SelectComponents.DropdownIndicator>
	)

	// create menu-entries with (1) optional left-hand icon, (2) label, (3) optional right-side "external link" icon
	const CustomOption = ({ children, ...props }: OptionProps<MenuOption>) => {
		const { data } = props

		const isUrl = data.destination !== 'whatsNewOpen'
		const navProps = isUrl
			? { to: data.destination, target: '_blank', rel: 'noopener noreferrer', as: Link }
			: { onClick: whatsNewOpen }

		// Structure: [CNavLink [left-icon, text, right-icon ]]
		return (
			<>
				{data.newSection && (
					<hr style={{ margin: '0px 10px', borderColor: '#000' }} /> // Simple styling for the divider
				)}
				<SelectComponents.Option {...props}>
					<CNavLink {...navProps} title={data.tooltip}>
						<span
							{...props.innerProps}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<span>
								{typeof data.icon === 'function' ? (
									data.icon()
								) : (
									<FontAwesomeIcon
										icon={data.icon ? data.icon : faInfo}
										style={{ visibility: data.icon ? 'inherit' : 'hidden', paddingRight: '0.5em' }}
									/>
								)}

								{children}
							</span>

							{data.isExternal ? <FontAwesomeIcon icon={faExternalLinkSquare} /> : ' '}
						</span>
					</CNavLink>
				</SelectComponents.Option>
			</>
		)
	}

	return (
		<Select
			controlShouldRenderValue={false}
			options={menuOptions}
			value={null}
			maxMenuHeight={1000} // Need to figure something better?
			components={{
				//Control: CustomControl,
				ValueContainer: () => null, // don't show input
				DropdownIndicator: HelpIconIndicator, // the menu icon
				Input: () => null, // don't show input
				IndicatorSeparator: () => null, // don't show vertical line
				//IndicatorsContainer: () => null, // don't show down arrow, etc.
				Option: CustomOption,
			}}
			styles={{
				control: (base) => ({
					// affects the parent of the value-container & dropdown indicator...
					...base,
					backgroundColor: 'var(--cui-header-bg)',
					border: 0,
				}),
				dropdownIndicator: (base) => ({
					...base,
					// provide a darker background for the circle-help icon
					borderRadius: '100%',
					padding: '0.2em 0em', // to make the circle round
					backgroundColor: 'var(--companion-header-brand-bg)',
					color: 'var(--cui-header-color)', // color when focused is handled independently. not sure where!
				}),
				menu: (base) => ({
					// the drop-down
					...base,
					right: '-1em', // right-justify the pull-down relative to the control or container
					width: '16em',
					backgroundColor: 'var(--cui-header-bg)',
				}),
				option: (base, state) => ({
					...base,
					// note: hover color is controlled by `.header .nav-link:hover` in _layout.scss, which overrides color here
					color: 'var(--cui-header-color)',
					backgroundColor: state.isFocused ? 'var(--companion-header-brand-bg)' : 'var(--cui-header-bg)',
					paddingLeft: 0,
				}),
			}}
		/>
	)
}
