import { CCol } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useId, useRef, useState } from 'react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const GridConfigRows = observer(function GridConfigRows(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Button Grid" />

			<UserConfigStaticTextRow
				label="Grid Size"
				text={
					<>
						<div>
							{props.config.gridSize.maxRow - props.config.gridSize.minRow + 1} rows x{' '}
							{props.config.gridSize.maxColumn - props.config.gridSize.minColumn + 1} columns
						</div>

						<GridSizeModal />
					</>
				}
			/>
			<UserConfigStaticTextRow
				label={<em>Current grid rows</em>}
				text={`${props.config.gridSize.minRow} to ${props.config.gridSize.maxRow}`}
			/>
			<UserConfigStaticTextRow
				label={<em>Current grid columns</em>}
				text={`${props.config.gridSize.minColumn} to ${props.config.gridSize.maxColumn}`}
			/>

			<UserConfigSwitchRow
				userConfig={props}
				label="Prompt to expand grid when attaching new surface"
				field="gridSizePromptGrow"
			/>
		</>
	)
})

export const GridSizeModal = observer(function GridSizeModal() {
	const { userConfig } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)

	const [newGridSize, setNewGridSize] = useState<UserConfigGridSize | null>(null)

	const buttonRef = useRef<HTMLButtonElement | null>(null)

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())
	const doAction = useCallback(
		(e: React.FormEvent) => {
			if (e) e.preventDefault()

			setShow(false)
			if (!newGridSize) return // this should be impossible in the callback!

			setConfigKeyMutation.mutate({ key: 'gridSize', value: newGridSize })
		},
		[newGridSize, setConfigKeyMutation]
	)

	const onOpenChange = useCallback(
		(open: boolean) => {
			setShow(open)

			if (open) {
				setNewGridSize((oldGridSize) => {
					if (userConfig.properties) return userConfig.properties.gridSize
					return oldGridSize
				})
			}
		},
		[userConfig]
	)

	const setMinColumn = useCallback((newValue: number) => {
		if (Number.isNaN(newValue)) return
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						minColumn: newValue,
					}
				: null
		)
	}, [])
	const setMaxColumn = useCallback((newValue: number) => {
		if (Number.isNaN(newValue)) return
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						maxColumn: newValue,
					}
				: null
		)
	}, [])
	const setMinRow = useCallback((newValue: number) => {
		if (Number.isNaN(newValue)) return
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						minRow: newValue,
					}
				: null
		)
	}, [])
	const setMaxRow = useCallback((newValue: number) => {
		if (Number.isNaN(newValue)) return
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						maxRow: newValue,
					}
				: null
		)
	}, [])

	const isReducingSize =
		newGridSize &&
		userConfig?.properties?.gridSize &&
		(newGridSize.minColumn > userConfig.properties.gridSize.minColumn ||
			newGridSize.maxColumn < userConfig.properties.gridSize.maxColumn ||
			newGridSize.minRow > userConfig.properties.gridSize.minRow ||
			newGridSize.maxRow < userConfig.properties.gridSize.maxRow)

	const minRowFieldId = useId()
	const maxRowFieldId = useId()
	const minColumnFieldId = useId()
	const maxColumnFieldId = useId()

	return (
		<Modal.Root open={show} onOpenChange={onOpenChange}>
			<Modal.Trigger color="secondary" size="sm" className="mt-1">
				Edit size
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup initialFocus={buttonRef}>
						<Modal.Header closeButton>
							<Modal.Title>Configure Grid Size</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<Form onSubmit={doAction} className="row">
								{newGridSize && (
									<CCol sm={12} className="mb-3">
										New Grid Size: {newGridSize.maxRow - newGridSize.minRow + 1} rows x{' '}
										{newGridSize.maxColumn - newGridSize.minColumn + 1} columns
									</CCol>
								)}

								<FormLabel htmlFor={minRowFieldId} className="col-sm-3 col-form-label col-form-label-sm mb-2">
									Min Row
								</FormLabel>
								<CCol sm={9} className="mb-2">
									<NumberInputField
										id={minRowFieldId}
										value={newGridSize?.minRow}
										max={0}
										step={1}
										setValue={setMinRow}
									/>
								</CCol>

								<FormLabel htmlFor={maxRowFieldId} className="col-sm-3 col-form-label col-form-label-sm mb-2">
									Max Row
								</FormLabel>
								<CCol sm={9} className="mb-2">
									<NumberInputField
										id={maxRowFieldId}
										value={newGridSize?.maxRow}
										min={0}
										step={1}
										setValue={setMaxRow}
									/>
								</CCol>

								<FormLabel htmlFor={minColumnFieldId} className="col-sm-3 col-form-label col-form-label-sm mb-2">
									Min Column
								</FormLabel>
								<CCol sm={9} className="mb-2">
									<NumberInputField
										id={minColumnFieldId}
										value={newGridSize?.minColumn}
										max={0}
										step={1}
										setValue={setMinColumn}
									/>
								</CCol>

								<FormLabel htmlFor={maxColumnFieldId} className="col-sm-3 col-form-label col-form-label-sm mb-2">
									Max Column
								</FormLabel>
								<CCol sm={9} className="mb-2">
									<NumberInputField
										id={maxColumnFieldId}
										value={newGridSize?.maxColumn}
										min={0}
										step={1}
										setValue={setMaxColumn}
									/>
								</CCol>
							</Form>
							{isReducingSize && (
								<StaticAlert color="danger" className="mb-0 mt-2">
									By reducing the grid size, any buttons outside of the new boundaries will be deleted.
								</StaticAlert>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close>Cancel</Modal.Close>
							<Button ref={buttonRef} color="primary" onClick={doAction}>
								Save
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})
