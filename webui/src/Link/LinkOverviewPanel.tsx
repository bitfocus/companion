import { faLink, faRotate } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ConfigFieldRow } from '~/UserConfig/Components/ConfigFieldRows.js'

/** Shown when no installation is selected: what other installations see of this one */
export const LinkOverviewPanel = observer(function LinkOverviewPanel(): React.JSX.Element {
	const { link: linkStore } = useContext(RootAppStoreContext)
	const self = linkStore.self

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const regenerateMutation = useMutationExt(trpc.link.regenerateId.mutationOptions())

	const doRegenerate = useCallback(() => {
		confirmModalRef.current?.show(
			'Regenerate Link id',
			[
				'Other installations will see this as a new installation.',
				'Remote buttons on them that show this installation will stop working until they are edited to choose it again, and direct connections will need pairing again.',
				'Only do this if this installation was copied from another, so that they share an id.',
			],
			'Regenerate',
			() => {
				regenerateMutation.mutateAsync().catch((e) => {
					console.error('Failed to regenerate id', e)
				})
			}
		)
	}, [regenerateMutation])

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />
			<PanelHeader icon={faLink} title="This installation">
				{null}
			</PanelHeader>

			<div className="secondary-panel-simple-body p-4 flex flex-col gap-4">
				<EditSectionCard title="Seen by others as">
					<ConfigFieldRow label="Name" htmlFor={null} help="Set by the Installation Name in Settings">
						{self?.name ?? '…'}
					</ConfigFieldRow>
					<ConfigFieldRow label="Link id" htmlFor={null} help={null}>
						<div className="flex items-center gap-2 min-w-0">
							<span className="truncate font-mono" title={self?.id}>
								{self?.fingerprint ?? '…'}
							</span>
							{self && <CopyButton text={self.id} variant="ghost" />}
							<Button
								size="sm"
								color="secondary"
								variant="ghost"
								title="Regenerate the Link id"
								onClick={doRegenerate}
								disabled={!self}
							>
								<FontAwesomeIcon icon={faRotate} />
							</Button>
						</div>
					</ConfigFieldRow>
					<ConfigFieldRow label="Protocol versions" htmlFor={null} help={null}>
						{self?.protocolVersions.join(', ') ?? '…'}
					</ConfigFieldRow>
				</EditSectionCard>

				<NonIdealState icon={faLink}>
					<p className="mb-1">Select an installation to choose what it may use, and see what it uses.</p>
					<p className="text-sm text-muted mb-0">
						To show a button from another installation, choose <b>Remote button</b> when creating a button.
					</p>
				</NonIdealState>
			</div>
		</>
	)
})
