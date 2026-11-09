import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { Button } from './Button'
import './LearnButton.css'

interface LearnButtonProps {
	id: string
	disabled?: boolean
	doLearn: () => void
	/** Cancel the active learn, if it can be cancelled */
	doCancel: (() => void) | undefined
}

export const LearnButton = observer(function LearnButton({ id, disabled, doLearn, doCancel }: LearnButtonProps) {
	const rootAppStore = useContext(RootAppStoreContext)

	const isActive = rootAppStore.activeLearns.has(id)

	return (
		<Button
			className="learn-button"
			disabled={disabled || (isActive && !doCancel)}
			color="secondary"
			size="sm"
			onClick={isActive ? doCancel : doLearn}
			title={isActive ? 'Cancel capturing the current values' : 'Capture the current values from the device'}
		>
			{/* Both labels share one grid cell, so the button keeps its width when switching */}
			<span className="labels">
				<span className={classNames({ inactive: isActive })}>Learn values</span>
				<span className={classNames({ inactive: !isActive })}>
					<FontAwesomeIcon icon={faSync} spin={isActive} /> Cancel
				</span>
			</span>
		</Button>
	)
})
