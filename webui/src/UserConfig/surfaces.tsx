import { faCog } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { SettingsCard } from './Components/SettingsCard.js'
import { useUserConfigProps } from './Context.js'
import { PinLockoutConfig } from './Sections/PinLockoutConfig.js'
import { SurfacesConfig } from './Sections/SurfacesConfig.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsSurfacesPage = memo(function UserConfig() {
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#surfaces" />

			<div className="page-shell-body">
				<SettingsNav activeTab="surfaces" />

				<div className="page-scroll">
					<div className="primary-panel">
						<PageIntro title="Surface Settings">
							These settings affect all surfaces. Surface integrations are configured on the Surfaces page.
						</PageIntro>
						<UserConfigTable />
					</div>
				</div>
			</div>
		</div>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()

	if (!userConfigProps) return null

	return (
		<div className="w-full space-y-4">
			<SettingsCard>
				<SurfacesConfig {...userConfigProps} />
			</SettingsCard>
			<SettingsCard>
				<PinLockoutConfig {...userConfigProps} />
			</SettingsCard>
		</div>
	)
})
