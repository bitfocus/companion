import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LinkButtonExternal } from '~/Components/Button'
import { makeAbsolutePath } from '~/Resources/util'

export function ArtnetProtocol(): React.JSX.Element {
	return (
		<>
			<div className="my-3">
				<LinkButtonExternal color="success" href={makeAbsolutePath('/Bitfocus_Companion_v20.d4')}>
					<FontAwesomeIcon icon={faFileImport} /> Download Avolites Fixture file (v2.0)
				</LinkButtonExternal>
			</div>
			<div className="my-3">
				<LinkButtonExternal color="success" href={makeAbsolutePath('/bitfocus@companion_v2.0@00.xml')}>
					<FontAwesomeIcon icon={faFileImport} /> Download GrandMA2 Fixture file (v2.0)
				</LinkButtonExternal>
			</div>
			<div className="my-3">
				<LinkButtonExternal color="success" href={makeAbsolutePath('/Bitfocus Companion Fixture.v3f')}>
					<FontAwesomeIcon icon={faFileImport} /> Download Vista Fixture file (v2.0)
				</LinkButtonExternal>
			</div>
		</>
	)
}
