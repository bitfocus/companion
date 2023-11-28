import React, { useContext } from 'react'
import { CButton } from '@coreui/react'
import { ActiveLearnContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'

interface LearnButtonProps {
	id: string
	disabled?: boolean
	doLearn: () => void
}

export const LearnButton = observer(function LearnButton({ id, disabled, doLearn }: LearnButtonProps) {
	const activeLearnRequets = useContext(ActiveLearnContext)

	const isActive = activeLearnRequets.has(id)

	return (
		<CButton
			disabled={isActive || disabled}
			color="info"
			size="sm"
			onClick={doLearn}
			title="Capture the current values from the device"
		>
			Learn {isActive && <FontAwesomeIcon icon={faSync} spin />}
		</CButton>
	)
})
