import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'
import { makeAbsolutePath } from '~/Resources/util'

export function ArtnetProtocol(): React.JSX.Element {
	return (
		<>
			<p>
				<CButton color="success" href={makeAbsolutePath('/Bitfocus_Companion_v20.d4')} target="_blank">
					<FontAwesomeIcon icon={faFileImport} /> Download Avolites Fixture file (v2.0)
				</CButton>
			</p>
			<p>
				<CButton color="success" href={makeAbsolutePath('/bitfocus@companion_v2.0@00.xml')} target="_blank">
					<FontAwesomeIcon icon={faFileImport} /> Download GrandMA2 Fixture file (v2.0)
				</CButton>
			</p>
			<p>
				<CButton color="success" href={makeAbsolutePath('/Bitfocus Companion Fixture.v3f')} target="_blank">
					<FontAwesomeIcon icon={faFileImport} /> Download Vista Fixture file (v2.0)
				</CButton>
			</p>
		</>
	)
}
