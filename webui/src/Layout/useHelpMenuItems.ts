import { faFacebook, faGithub, faSlack } from '@fortawesome/free-brands-svg-icons'
import { faDollarSign, faInfo, faStar, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { useCallback, useContext, useMemo } from 'react'
import type { MenuActionItemProps, MenuItemProps } from '~/Components/ActionMenu.js'
import { MenuSeparator } from '~/Components/useContextMenuProps.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCompanionVersion } from './useCompanionVersion'

/** The app-wide Help menu: the user guide, the setup wizard, release notes and the version to copy */
export function useHelpMenuItems(): MenuItemProps[] {
	const { whatsNewModal, notifier, wizardOpen } = useContext(RootAppStoreContext)
	const whatsNewOpen = useCallback(() => whatsNewModal.current?.show(), [whatsNewModal])
	const openWizard = useCallback(() => wizardOpen.set(true), [wizardOpen])

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

	const helpMenuItems: MenuItemProps[] = useMemo(
		() => [
			{
				id: 'user-guide',
				label: 'User Guide / Help',
				icon: faInfo,
				href: makeAbsolutePath('/user-guide/'),
				tooltip: 'Open the User Guide in a new tab.',
				inNewTab: true,
			},
			{
				id: 'setup-wizard',
				label: 'Getting Started Wizard',
				icon: faWandMagicSparkles,
				do: openWizard,
				tooltip: 'Open the initial setup and configuration wizard.',
				inNewTab: false,
			},
			{
				id: 'whats-new',
				label: "What's New",
				icon: faStar,
				do: whatsNewOpen,
				tooltip: 'Show the current release notes.',
				inNewTab: false,
			},
			MenuSeparator,
			{
				id: 'github',
				label: 'Report an Issue',
				icon: faGithub,
				href: 'https://l.companion.free/q/QZbI6mdNd',
				tooltip: 'Report bugs or request features on GitHub.',
				inNewTab: true,
			},
			{
				id: 'sponsor',
				label: 'Sponsor Companion',
				icon: faDollarSign,
				href: 'https://l.companion.free/q/6PtdAvZab',
				tooltip: 'Contribute funds to Bitfocus Companion.',
				inNewTab: true,
			},
			{
				id: 'slack',
				label: 'Slack Community',
				icon: faSlack,
				href: 'https://l.companion.free/q/OWxbBnDKG',
				tooltip: 'Discuss technical issues on Slack.',
				inNewTab: true,
			},
			{
				id: 'fb',
				label: 'Facebook Community Support',
				icon: faFacebook,
				href: 'https://l.companion.free/q/6pc9ciJR5',
				tooltip: 'Share your experience or ask questions to your Companions.',
				inNewTab: true,
			},
			MenuSeparator,
			{
				id: 'version',
				label: sysinfo.version,
				fullWidth: true,
				do: () => {},
				tooltip: 'Click to copy version info including OS and browser to the clipboard.',
				copyToClipboard: copyVersionToClipboard,
			},
		],
		[copyVersionToClipboard, openWizard, sysinfo, whatsNewOpen]
	)

	return helpMenuItems
}
