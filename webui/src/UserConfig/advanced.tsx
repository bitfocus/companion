import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { Table } from '~/Components/Table.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { useUserConfigProps } from './Context.js'
import { AdminPasswordConfig } from './Sections/AdminPasswordConfig.js'
import { ExperimentsConfig } from './Sections/ExperimentsConfig.js'
import { HttpsConfig } from './Sections/HttpsConfig.js'

export const SettingsAdvancedPage = memo(function UserConfig() {
	return (
		<SplitPanels.Root showing={null} resize={null}>
			<SplitPanels.Primary>
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="flex justify-between">
							<div>
								<h4>Settings - Advanced</h4>
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
		<Table className="table-settings">
			<tbody>
				<AdminPasswordConfig {...userConfigProps} />

				<HttpsConfig {...userConfigProps} />

				<ExperimentsConfig {...userConfigProps} />
			</tbody>
		</Table>
	)
})
