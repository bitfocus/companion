import React, { useContext } from 'react'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

interface LearnButtonProps {
	id: string
	disabled?: boolean
	doLearn: () => void
}

export const LearnButton = observer(function LearnButton({ id, disabled, doLearn }: LearnButtonProps) {
	const rootAppStore = useContext(RootAppStoreContext)

	const isActive = rootAppStore.activeLearns.has(id)

	return (
		<CButton
			disabled={isActive || disabled}
			color="info"
			size="sm"
			onClick={doLearn}
			title="Capture the current values from the device"
		>
			Learn values {isActive && <FontAwesomeIcon icon={faSync} spin />}
		</CButton>
	)
})
