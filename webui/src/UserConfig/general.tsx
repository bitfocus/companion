import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { Table } from '~/Components/Table.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { useUserConfigProps } from './Context.js'
import { CompanionConfig } from './Sections/CompanionConfig.js'
import { DataCollectionConfig } from './Sections/DataCollection.js'

export const SettingsGeneralPage = memo(function UserConfig() {
	return (
		<SplitPanels.Root showing={null} resize={null}>
			<SplitPanels.Primary>
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="flex justify-between">
							<div>
								<h4>Settings - General</h4>
								<p>Settings apply instantaneously, don't worry about it!</p>
							</div>
						</div>
					</div>
					<div className="scrollable-content">
						<UserConfigTable />
					</div>
				</div>
			</SplitPanels.Primary>
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
					<CompanionConfig {...userConfigProps} />
				</tbody>
			</Table>
			<Table className="table-settings">
				<tbody>
					<DataCollectionConfig {...userConfigProps} />
				</tbody>
			</Table>
		</>
	)
})
