import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { Table } from '~/Components/Table.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { useUserConfigProps } from './Context.js'
import { ButtonsConfig } from './Sections/ButtonsConfig.js'
import { GridConfigRows } from './Sections/GridConfig.js'

export const SettingsButtonsPage = memo(function UserConfig() {
	return (
		<SplitPanels.Root showing={null} resize={null}>
			<SplitPanels.Primary>
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="flex justify-between">
							<div>
								<h4>Settings - Buttons</h4>
								<p>Settings apply instantaneously, don't worry about it!</p>
							</div>
						</div>
					</div>
					<div className="scrollable-content">
						<UserConfigTable />
					</div>
				</div>
			</SplitPanels.Primary>
			{/* <div className="secondary-panel">
				<div className="secondary-panel-header">
					<h4>Remote control</h4>
					<p>Companion can be remote controlled in several ways. Below you'll find how to do it.</p>
				</div>
				<div className="secondary-panel-inner">
				</div>
			</div> */}
		</SplitPanels.Root>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()

	if (!userConfigProps) return null

	return (
		<>
			<Table className="table-settings">
				<tbody>
					<ButtonsConfig {...userConfigProps} />
					<GridConfigRows {...userConfigProps} />
				</tbody>
			</Table>
		</>
	)
})
