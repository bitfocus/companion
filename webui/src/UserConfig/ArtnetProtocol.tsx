import React from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'

export function ArtnetProtocol() {
	return (
		<>
			<p>
				<CButton color="success" href="/Bitfocus_Companion_v20.d4" target="_new">
					<FontAwesomeIcon icon={faFileImport} /> Download Avolites Fixture file (v2.0)
				</CButton>
			</p>
			<p>
				<CButton color="success" href="/bitfocus@companion_v2.0@00.xml" target="_new">
					<FontAwesomeIcon icon={faFileImport} /> Download GrandMA2 Fixture file (v2.0)
				</CButton>
			</p>
			<p>
				<CButton color="success" href="/Bitfocus Companion Fixture.v3f" target="_new">
					<FontAwesomeIcon icon={faFileImport} /> Download Vista Fixture file (v2.0)
				</CButton>
			</p>
		</>
	)
}
