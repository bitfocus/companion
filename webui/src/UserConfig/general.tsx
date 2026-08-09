import { observer } from 'mobx-react-lite'
import { memo } from 'react'
import { Grid } from '~/Components/Grid'
import { Table } from '~/Components/Table.js'
import { useUserConfigProps } from './Context.js'
import { CompanionConfig } from './Sections/CompanionConfig.js'
import { DataCollectionConfig } from './Sections/DataCollection.js'

export const SettingsGeneralPage = memo(function UserConfig() {
	return (
		<Grid.Row className="split-panels">
			<Grid.Col xl={6} className="primary-panel">
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="cui-d-flex cui-justify-content-between">
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
			</Grid.Col>
		</Grid.Row>
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
