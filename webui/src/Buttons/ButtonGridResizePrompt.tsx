import { CAlert, CButton } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export const ButtonGridResizePrompt = observer(function ButtonGridResizePrompt(): React.ReactNode {
	const { surfaces, userConfig } = useContext(RootAppStoreContext)

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())

	const overflowing = userConfig.properties && surfaces.getSurfacesOverflowingBounds(userConfig.properties.gridSize)
	if (!overflowing || overflowing.surfaces.length === 0) return null

	const doAutoResize = () => {
		if (!overflowing) return
		setConfigKeyMutation.mutate({ key: 'gridSize', value: overflowing.neededBounds })
	}

	const doDismiss = () => {
		if (!overflowing) return
		setConfigKeyMutation.mutate({ key: 'gridSizePromptGrow', value: false })
	}

	return (
		<>
			<CAlert color="info" onClose={doDismiss} dismissible>
				You have some surfaces which overflow the current grid bounds
				<ul>
					{overflowing.surfaces.map((s) => (
						<li key={s.id}>{s.displayName}</li>
					))}
				</ul>
				<CButton color="info" onClick={doAutoResize}>
					<FontAwesomeIcon icon={faExpand} />
					&nbsp;Resize grid to fit
				</CButton>
			</CAlert>
		</>
	)
})
