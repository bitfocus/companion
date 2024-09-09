import React from 'react'
import { observer } from 'mobx-react-lite'
import { InlineHelp } from '../Components/InlineHelp.js'
import { UserConfigHeadingRow } from './Components/UserConfigHeadingRow.js'
import { UserConfigProps } from './Components/Common.js'
import { UserConfigStaticTextRow } from './Components/UserConfigStaticTextRow.js'

export const SatelliteConfig = observer(function SatelliteConfig(_props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Satellite" />

			<UserConfigStaticTextRow
				label={<InlineHelp help="You can't change this value.">Satellite Listen Port</InlineHelp>}
				text={16622}
			/>
		</>
	)
})
