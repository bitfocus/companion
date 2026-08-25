import { faCompass, faEllipsis, faEraser, faFileExport, faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useRef } from 'react'
import { PopoverActionMenu, type MenuItemProps } from '~/Components/ActionMenu.js'
import { ConfirmExportModal, type ConfirmExportModalRef } from '~/Components/ConfirmExportModal.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Popover } from '~/Components/Popover.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { EditPagePropertiesModal, type EditPagePropertiesModalRef } from './EditPageProperties.js'

interface ButtonGridPageMenuProps {
	pageNumber: number
	pageInfo: PagesStoreModel | undefined
}

/**
 * Page-wide actions, kept one click away from the grid.
 */
export function ButtonGridPageMenu({ pageNumber, pageInfo }: ButtonGridPageMenuProps): React.JSX.Element {
	const confirmRef = useRef<GenericConfirmModalRef>(null)
	const editRef = useRef<EditPagePropertiesModalRef>(null)
	const exportModalRef = useRef<ConfirmExportModalRef>(null)

	const clearPageMutation = useMutationExt(trpc.pages.clearPage.mutationOptions())
	const recreateNavMutation = useMutationExt(trpc.pages.recreateNav.mutationOptions())

	const menuItems = useMemo((): MenuItemProps[] => {
		return [
			{
				label: 'Edit page',
				icon: faPencil,
				do: () => editRef.current?.show(Number(pageNumber), pageInfo),
			},
			{
				label: 'Export page',
				icon: faFileExport,
				do: () => exportModalRef.current?.show(makeAbsolutePath(`/int/export/page/${pageNumber}`)),
			},
			{ isSeparator: true, label: 'Danger zone' },
			{
				label: 'Recreate navigation buttons',
				icon: faCompass,
				do: () => {
					confirmRef.current?.show(
						'Reset page',
						`Are you sure you want to reset navigation buttons? This will completely erase button ${pageNumber}/0/0, ${pageNumber}/1/0 and ${pageNumber}/2/0`,
						'Reset',
						() => {
							recreateNavMutation.mutateAsync({ pageNumber }).catch((e) => {
								console.error(`Reset nav failed: ${e}`)
							})
						}
					)
				},
			},
			{
				label: 'Wipe page',
				icon: faEraser,
				do: () => {
					confirmRef.current?.show(
						'Reset page',
						`Are you sure you want to clear all buttons on page ${pageNumber}?\nThere's no going back from this.`,
						'Reset',
						() => {
							clearPageMutation.mutateAsync({ pageNumber }).catch((e) => {
								console.error(`Clear page failed: ${e}`)
							})
						}
					)
				},
			},
		]
	}, [pageNumber, pageInfo, clearPageMutation, recreateNavMutation])

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<EditPagePropertiesModal ref={editRef} includeName />
			<ConfirmExportModal ref={exportModalRef} title="Export Page" />

			<Popover.Root>
				<Popover.Trigger color="light" className="ms-1" title="Page actions">
					<FontAwesomeIcon icon={faEllipsis} />
				</Popover.Trigger>
				<Popover.Popup positionerClassName="action-menu" align="end">
					<PopoverActionMenu menuItems={menuItems} />
				</Popover.Popup>
			</Popover.Root>
		</>
	)
}
