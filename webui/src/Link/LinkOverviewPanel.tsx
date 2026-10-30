import { faLink, faRotate, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Note } from '~/Components/Note.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ConfigFieldRow } from '~/UserConfig/Components/ConfigFieldRows.js'

/** Shown when no installation is selected, or this one is: what other installations see of this one */
export const LinkOverviewPanel = observer(function LinkOverviewPanel(): React.JSX.Element {
	const { link: linkStore, notifier } = useContext(RootAppStoreContext)
	const self = linkStore.self
	const navigate = useNavigate()
	const isSelected = !!useMatchRoute()({ to: '/link/self' })

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
					notifier.show('Failed to regenerate Link id', e?.message ?? String(e))
				})
			}
		)
	}, [regenerateMutation, notifier])

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />
			<PanelHeader icon={faLink} title="This installation">
				{isSelected ? <CloseButton closeFn={() => void navigate({ to: '/link' })} /> : null}
			</PanelHeader>

			<div className="secondary-panel-simple-body p-4 flex flex-col gap-4">
				{self?.sharesLinkId && (
					<Note tone="warning" icon={faTriangleExclamation} actions={null}>
						Another installation is using the same Link id as this one, eg one was copied from the other. Other
						installations can't tell the two apart. Regenerate the Link id of one of them.
					</Note>
				)}
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
						To show a button from another installation, choose <b>Remote button</b> when creating a button, or drag one
						from <b>Other installations</b> in the <b>Presets</b> tab of the Buttons page.
					</p>
				</NonIdealState>
			</div>
		</>
	)
})
