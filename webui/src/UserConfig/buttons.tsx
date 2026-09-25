import { faCog } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PageIntro } from '~/Layout/PageIntro'
import { SettingsCard } from './Components/SettingsCard.js'
import { useUserConfigProps } from './Context.js'
import { ButtonsConfig } from './Sections/ButtonsConfig.js'
import { GridConfigRows } from './Sections/GridConfig.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsButtonsPage = memo(function UserConfig() {
	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#buttons" />

			<div className="page-shell-body">
				<SettingsNav activeTab="buttons" />

				<div className="page-scroll">
					<div className="primary-panel">
						<PageIntro title="Button Settings">
							Configure button behavior, default press actions, grid dimensions, and surface controls.
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
				<ButtonsConfig {...userConfigProps} />
			</SettingsCard>
			<SettingsCard>
				<GridConfigRows {...userConfigProps} />
			</SettingsCard>
		</div>
	)
})
