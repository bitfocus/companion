import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { Button } from '~/Components/Button'
import { Note } from '~/Components/Note.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const ButtonGridResizePrompt = observer(function ButtonGridResizePrompt(): React.ReactNode {
	const { surfaces, userConfig } = useContext(RootAppStoreContext)

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())

	const overflowing = userConfig.properties && surfaces.getSurfacesOverflowingBounds(userConfig.properties.gridSize)
	if (!overflowing || overflowing.surfaces.length === 0 || !userConfig.properties.gridSizePromptGrow) return null

	const doAutoResize = () => {
		if (!overflowing) return
		setConfigKeyMutation.mutate({ key: 'gridSize', value: overflowing.neededBounds })
	}

	const doDismiss = () => {
		if (!overflowing) return
		setConfigKeyMutation.mutate({ key: 'gridSizePromptGrow', value: false })
	}

	const count = overflowing.surfaces.length

	return (
		<Note
			tone="warning"
			icon={faTriangleExclamation}
			actions={
				<>
					<Button variant="outline" size="sm" onClick={doAutoResize}>
						Resize grid to fit
					</Button>
					<Button variant="icon" size="sm" onClick={doDismiss} title="Don't ask again">
						<FontAwesomeIcon icon={faXmark} />
					</Button>
				</>
			}
		>
			{count === 1 ? '1 surface overflows' : `${count} surfaces overflow`} the grid:
			<ul className="mt-1 mb-0 ps-4 list-disc">
				{overflowing.surfaces.map((s) => (
					<li key={s.id}>{s.displayName}</li>
				))}
			</ul>
		</Note>
	)
})
