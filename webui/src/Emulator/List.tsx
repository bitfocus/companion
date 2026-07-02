import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { NonIdealState } from '~/Components/NonIdealState'
import { StandalonePageError } from '~/Components/StandalonePageError.js'
import { trpc } from '~/Resources/TRPC'
import { EmulatorListCard } from './ListCard.js'
import { EmulatorListFooter } from './ListFooter.js'
import { EmulatorListHeader } from './ListHeader.js'

export const EmulatorList = observer(function EmulatorList() {
	const emulatorList = useSubscription(trpc.surfaces.emulatorList.subscriptionOptions())
	const emulatorPageConfig = useSubscription(trpc.surfaces.emulatorPageConfig.subscriptionOptions())
	const doRetryLoad = useCallback(() => emulatorList.reset(), [emulatorList])

	if (!emulatorList.data) {
		return <StandalonePageError error={emulatorList.error} dataReady={false} doRetry={doRetryLoad} />
	}

	return (
		<div className="page-emulator-list">
			<div className="emulator-list-inner">
				<EmulatorListHeader installName={emulatorPageConfig.data?.installName} />

				{emulatorList.data.length > 0 ? (
					<div className="emulator-grid">
						{emulatorList.data.map((surface) => (
							<EmulatorListCard key={surface.id} surface={surface} />
						))}
					</div>
				) : (
					<NonIdealState icon={faGamepad} className="emulator-nonideal">
						No Emulators have been created
						<br />
						You can create one in the Surfaces tab
					</NonIdealState>
				)}

				<EmulatorListFooter />
			</div>
		</div>
	)
})
