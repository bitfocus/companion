import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { Button } from './Button'

interface LearnButtonProps {
	id: string
	disabled?: boolean
	doLearn: () => void
}

export const LearnButton = observer(function LearnButton({ id, disabled, doLearn }: LearnButtonProps) {
	const rootAppStore = useContext(RootAppStoreContext)

	const isActive = rootAppStore.activeLearns.has(id)

	return (
		<Button
			disabled={isActive || disabled}
			color="info"
			size="sm"
			onClick={doLearn}
			title="Capture the current values from the device"
		>
			Learn values {isActive && <FontAwesomeIcon icon={faSync} spin />}
		</Button>
	)
})
