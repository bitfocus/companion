import {
	CContainer,
	CDropdown,
	CDropdownToggle,
	CHeader,
	CHeaderBrand,
	CHeaderNav,
	CHeaderToggler,
	CNavItem,
	CNavLink,
} from '@coreui/react'
import { faFacebook, faGithub, faSlack } from '@fortawesome/free-brands-svg-icons'
import { faCircleQuestion, faCircle as faOpenCircle } from '@fortawesome/free-regular-svg-icons'
import {
	faBars,
	faDollarSign,
	faExternalLinkSquare,
	faInfo,
	faLock,
	faStar,
	faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, type ReactElement } from 'react'
import { ActionMenu, type MenuActionItemProps, type MenuItemProps } from '~/Components/ActionMenu.js'
import { MenuSeparator } from '~/Components/useContextMenuProps.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc } from '../Resources/TRPC.js'
import { useSidebarState } from './Sidebar.js'
import { useCompanionVersion } from './useCompanionVersion.js'

interface MyHeaderProps {
	canLock: boolean
	setLocked: (locked: boolean) => void
}

// make our own circleInfo since it's not in the free FontAwesome offering (two options here)
// note: the inline styling here is because it's aligning the compound element components rather than a stylistic choice.
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
				style={{
					height: '0.75em',
					width: '0.75em',
					border: '0.15em solid',
					borderRadius: '100%',
					padding: '0.15em',
					marginBottom: '-0.1em', // optional but centers slightly better vertically
				}}
			/>
		)
	}
}

export const MyHeader = observer(function MyHeader({ canLock, setLocked }: MyHeaderProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const { mobileMode, handleShowSidebar } = useSidebarState()

	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())

	return (
		// note: position="sticky" is not necessary since the header is never part of a scrolling element.
		//  if position is sticky, the header is assigned z-index: 1020, which interferes with popups (monaco suggest-details, for example)
		//  and would likely have to be overridden anyway (to be no more than 40, in the monaco case).
		<CHeader className="p-0">
			<CContainer fluid>
				{mobileMode && (
					<CHeaderToggler className="ps-1" onClick={handleShowSidebar}>
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
							<CNavLink target="_blank" href={updateData.data.link || 'https://companion.free/'}>
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

	// get notifier for adding a toast notification when copied to clipboard.
	const { notifier } = useContext(RootAppStoreContext)

	const { versionName, versionBuild, os, browser } = useCompanionVersion(true)
	const sysinfo = useMemo(() => {
		let version = versionName || 'version unknown'
		let versionPlus = 'Companion: ' + version
		if (versionBuild) {
			version += '\n' + versionBuild
			versionPlus += ' ' + versionBuild
		}
		versionPlus += `\nOS: ${os}\nBrowser: ${browser}\n`
		return { version, versionPlus }
	}, [versionName, versionBuild, os, browser])

	const copyVersionToClipboard = useMemo(
		// return a props object to be passed to <CopyToClipboard>
		(): MenuActionItemProps['copyToClipboard'] => ({
			text: sysinfo.versionPlus,
			onCopy: (_text, result) => {
				const success = 'Version info copied!'
				const failure = 'Failed to copy version-string to the clipboard'
				notifier.show('', result ? success : failure, 1000)
			},
		}),
		[sysinfo, notifier]
	)

	// note: the definition has to be inside a component so that we can grab `whatsNewOpen` which is a useCallback...
	const helpMenuItems: MenuItemProps[] = useMemo(
		() => [
			{
				id: 'user-guide',
				label: 'User Guide / Help',
				icon: circleInfo, // this is a function call, unlike the rest.
				href: makeAbsolutePath('/user-guide/'),
				tooltip: 'Open the User Guide in a new tab.',
				inNewTab: true,
			},
			{
				id: 'whats-new',
				label: "What's New",
				icon: faStar,
				do: whatsNewOpen,
				tooltip: 'Show the current release notes.',
				inNewTab: false,
			},
			{ ...MenuSeparator, label: 'Additional Support' },
			{
				id: 'fb',
				label: 'Community Support',
				icon: faFacebook,
				href: 'https://l.companion.free/q/6pc9ciJR5',
				tooltip: 'Share your experience or ask questions to your Companions.',
				inNewTab: true,
			},
			{
				id: 'slack',
				label: 'Slack Workspace',
				icon: faSlack,
				href: 'https://l.companion.free/q/OWxbBnDKG',
				tooltip: 'Discuss technical issues on Slack.',
				inNewTab: true,
			},
			{
				id: 'github',
				label: 'Report an Issue',
				icon: faGithub,
				href: 'https://l.companion.free/q/QZbI6mdNd',
				tooltip: 'Report bugs or request features on GitHub.',
				inNewTab: true,
			},
			MenuSeparator,
			{
				id: 'sponsor',
				label: 'Sponsor Companion',
				icon: faDollarSign,
				href: 'https://l.companion.free/q/6PtdAvZab',
				tooltip: 'Contribute funds to Bitfocus Companion.',
				inNewTab: true,
			},
			MenuSeparator,
			{
				id: 'version',
				label: sysinfo.version,
				fullWidth: true,
				do: () => {}, // no additional action needed
				tooltip: 'Click to copy version info including OS and browser to the clipboard.',
				copyToClipboard: copyVersionToClipboard,
			},
		],
		[copyVersionToClipboard, sysinfo, whatsNewOpen]
	)

	// technical detail: unlike the other elements, CDropdownToggle does not define a 'dropdown-toggle' CSS class,
	// but worse, if you add it manually, `caret={false}` is ignored, so it's named 'help-toggle' here.
	return (
		// note: CDropdown is assigned class btn-group. Previously _common.scss incorrectly assigned "overflow: hidden" to this class
		//  which caused the dropdown to be clipped out of existence. Leading to the former note... now all is good.
		//  and the dropdown is automatically assigned z-index: 1000 (--cui-dropdown-zindex)
		// former note: without position-static, the menu doesn't show. Alternatively, set style={{position: 'inherit'}} or play with z-index
		<CDropdown className="help-menu" offset={[10, 0]}>
			<CDropdownToggle color="primary" caret={false} className="help-toggle" aria-label="Help and support menu">
				<FontAwesomeIcon icon={faCircleQuestion} className="fa-2xl" />
			</CDropdownToggle>

			<ActionMenu menuItems={helpMenuItems} />
		</CDropdown>
	)
}
