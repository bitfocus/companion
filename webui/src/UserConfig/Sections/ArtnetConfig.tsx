import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { LinkButtonExternal } from '~/Components/Button'
import { makeAbsolutePath } from '~/Resources/util'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigFieldRow, ConfigNumberField } from '../Components/ConfigFieldRows.js'

const FIXTURE_FILES = [
	{ label: 'Avolites', path: '/Bitfocus_Companion_v20.d4' },
	{ label: 'GrandMA2', path: '/bitfocus@companion_v2.0@00.xml' },
	{ label: 'Vista', path: '/Bitfocus Companion Fixture.v3f' },
]

export const ArtnetConfig = observer(function ArtnetConfig(props: UserConfigProps) {
	return (
		<>
			<ConfigNumberField
				userConfig={props}
				label="Universe"
				field="artnet_universe"
				min={0}
				max={20055}
				help="The first universe is 0."
			/>
			<ConfigNumberField
				userConfig={props}
				label="Channel"
				field="artnet_channel"
				min={1}
				max={509}
				help="Buttons map to DMX channels counting up from this one."
			/>
			<ConfigFieldRow
				label="Fixture Files"
				htmlFor={null}
				help="Fixture files (v2.0) label the channels on your lighting console."
			>
				<div className="flex flex-wrap gap-2">
					{FIXTURE_FILES.map((file) => (
						<LinkButtonExternal key={file.path} color="secondary" size="sm" href={makeAbsolutePath(file.path)}>
							<FontAwesomeIcon icon={faFileImport} className="me-1.5" />
							{file.label}
						</LinkButtonExternal>
					))}
				</div>
			</ConfigFieldRow>
		</>
	)
})
