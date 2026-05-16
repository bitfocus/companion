import { CCol, CForm, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export interface GridConfigRowsProps extends UserConfigProps {
	// the current prop of the ref object:
	gridSizePopup: React.RefObject<GridSizeModalRef>
}
export const GridConfigRows = observer(function GridConfigRows(props: GridConfigRowsProps) {
	const editGridSize = useCallback(() => {
		props.gridSizePopup.current?.show()
	}, [props.gridSizePopup])

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
						<Button onClick={editGridSize} color="secondary" size="sm" style={{ marginTop: 4 }}>
							Edit size
						</Button>
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

export interface GridSizeModalRef {
	show(): void
}

export const GridSizeModal = observer<object, GridSizeModalRef>(
	React.forwardRef(function GridSizeModal(_props, ref) {
		const { userConfig } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)

		const [newGridSize, setNewGridSize] = useState<UserConfigGridSize | null>(null)

		const buttonRef = useRef<HTMLButtonElement | null>(null)

		const buttonFocus = () => {
			setTimeout(() => {
				if (buttonRef.current) {
					buttonRef.current.focus()
				}
			}, 500)
		}

		const doClose = useCallback(() => {
			setShow(false)
		}, [])

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

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		useEffect(() => {
			if (show) {
				setNewGridSize((oldGridSize) => {
					if (userConfig.properties) return userConfig.properties.gridSize
					return oldGridSize
				})
			}
		}, [show, userConfig])

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

		return (
			<CModal visible={show} onClose={doClose} onShow={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Configure Grid Size</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction} className="row">
						{newGridSize && (
							<CCol sm={12} className="mb-3">
								New Grid Size: {newGridSize.maxRow - newGridSize.minRow + 1} rows x{' '}
								{newGridSize.maxColumn - newGridSize.minColumn + 1} columns
							</CCol>
						)}

						<CFormLabel htmlFor="colFormMinRow" className="col-sm-3 col-form-label col-form-label-sm mb-2">
							Min Row
						</CFormLabel>
						<CCol sm={9} className="mb-2">
							<NumberInputField id="colFormMinRow" value={newGridSize?.minRow} max={0} step={1} setValue={setMinRow} />
						</CCol>

						<CFormLabel htmlFor="colFormMaxRow" className="col-sm-3 col-form-label col-form-label-sm mb-2">
							Max Row
						</CFormLabel>
						<CCol sm={9} className="mb-2">
							<NumberInputField id="colFormMaxRow" value={newGridSize?.maxRow} min={0} step={1} setValue={setMaxRow} />
						</CCol>

						<CFormLabel htmlFor="colFormMinColumn" className="col-sm-3 col-form-label col-form-label-sm mb-2">
							Min Column
						</CFormLabel>
						<CCol sm={9} className="mb-2">
							<NumberInputField
								id="colFormMinColumn"
								value={newGridSize?.minColumn}
								max={0}
								step={1}
								setValue={setMinColumn}
							/>
						</CCol>

						<CFormLabel htmlFor="colFormMaxColumn" className="col-sm-3 col-form-label col-form-label-sm mb-2">
							Max Column
						</CFormLabel>
						<CCol sm={9} className="mb-2">
							<NumberInputField
								id="colFormMaxColumn"
								value={newGridSize?.maxColumn}
								min={0}
								step={1}
								setValue={setMaxColumn}
							/>
						</CCol>
					</CForm>
					{isReducingSize && (
						<StaticAlert color="danger" className="mb-0 mt-2">
							By reducing the grid size, any buttons outside of the new boundaries will be deleted.
						</StaticAlert>
					)}
				</CModalBody>
				<CModalFooter>
					<Button color="secondary" onClick={doClose}>
						Cancel
					</Button>
					<Button ref={buttonRef} color="primary" onClick={doAction}>
						Save
					</Button>
				</CModalFooter>
			</CModal>
		)
	})
)
