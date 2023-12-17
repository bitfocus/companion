import React, { useCallback, useContext, useEffect, useState, useRef } from 'react'
import { socketEmitPromise, SocketContext, PagesContext, PreventDefaultHandler, UserConfigContext } from '../../util'
import { CButton, CButtonGroup, CCol, CRow, CForm, CLabel } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome } from '@fortawesome/free-solid-svg-icons'
import { useMemo } from 'react'
import { DropdownInputField } from '../../Components'
import { ButtonGridHeader } from '../ButtonGridHeader'
import { usePagePicker } from '../../Hooks/usePagePicker'
import { cloneDeep } from 'lodash-es'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { ButtonGridIcon, ButtonInfiniteGrid, ButtonInfiniteGridRef } from '../ButtonInfiniteGrid'
import { useHasBeenRendered } from '../../Hooks/useHasBeenRendered'
import type { DropdownChoiceId } from '@companion-module/base'
import type { ControlLocation } from '@companion/shared/Model/Common'
import type { NormalButtonModel } from '@companion/shared/Model/ButtonModel'

interface ButtonPickerProps {
	selectButton: (selectedControl: string, selectedStep: string, selectedSet: string, mode: 'replace' | 'append') => void
}
export function ButtonPicker({ selectButton }: ButtonPickerProps) {
	const socket = useContext(SocketContext)
	const pages = useContext(PagesContext)
	const userConfig = useContext(UserConfigContext)

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages, 1)

	const [selectedLocation, setSelectedLocation] = useState<ControlLocation | null>(null)
	const [selectedStep, setSelectedStep] = useState<string | null>(null)
	const [selectedSet, setSelectedSet] = useState<string | null>(null)

	const buttonClick = useCallback(
		(location, pressed) => {
			if (pressed) setSelectedLocation(location)
		},
		[pages[pageNumber]]
	)

	const selectedControl = useMemo(() => {
		return selectedLocation ? pages[pageNumber]?.controls?.[selectedLocation.row]?.[selectedLocation.column] : undefined
	}, [selectedLocation, pages[pageNumber]])

	// Reset set when control is changed
	useEffect(() => setSelectedSet(null), [selectedControl])

	const replaceActions = useCallback(() => {
		if (selectedControl && selectedStep && selectedSet)
			selectButton(selectedControl, selectedStep, selectedSet, 'replace')
	}, [selectedControl, selectedStep, selectedSet, selectButton])
	const appendActions = useCallback(() => {
		if (selectedControl && selectedStep && selectedSet)
			selectButton(selectedControl, selectedStep, selectedSet, 'append')
	}, [selectedControl, selectedStep, selectedSet, selectButton])

	const [controlInfo, setControlInfo] = useState<NormalButtonModel | null>(null)
	useEffect(() => {
		setControlInfo(null)

		if (!selectedControl) return
		socketEmitPromise(socket, 'controls:subscribe', [selectedControl])
			.then((config) => {
				console.log(config)
				setControlInfo(config?.config ?? false)
			})
			.catch((e) => {
				console.error('Failed to load control config', e)
				setControlInfo(null)
			})

		const patchConfig = (patch: JsonPatchOperation[] | false) => {
			setControlInfo((oldConfig) => {
				if (!oldConfig || patch === false) {
					return null
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
				}
			})
		}

		socket.on(`controls:config-${selectedControl}`, patchConfig)

		return () => {
			socket.off(`controls:config-${selectedControl}`, patchConfig)

			socketEmitPromise(socket, 'controls:unsubscribe', [selectedControl]).catch((e) => {
				console.error('Failed to unsubscribe control config', e)
			})
		}
	}, [socket, selectedControl])

	const actionStepOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button':
				return Object.keys(controlInfo.steps || {}).map((stepId) => ({
					id: stepId,
					label: `Step ${Number(stepId) + 1}`,
				}))
			default:
				return []
		}
	}, [controlInfo?.type, controlInfo?.steps])

	const selectedStepInfo = selectedStep ? controlInfo?.steps?.[selectedStep] : null
	const actionSetOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button': {
				const sets = [
					{
						id: 'down',
						label: 'Press',
					},
					{
						id: 'up',
						label: 'Release',
					},
				]

				if (selectedStepInfo?.action_sets?.['rotate_left'] || selectedStepInfo?.action_sets?.['rotate_right']) {
					sets.unshift(
						{
							id: 'rotate_left',
							label: 'Rotate left',
						},
						{
							id: 'rotate_right',
							label: 'Rotate right',
						}
					)
				}

				const candidate_sets = Object.keys(selectedStepInfo?.action_sets || {}).filter((id) => !isNaN(Number(id)))
				candidate_sets.sort((a, b) => Number(a) - Number(b))

				for (const set of candidate_sets) {
					sets.push({
						id: set,
						label: `Release after ${set}ms`,
					})
				}

				return sets
			}
			default:
				return []
		}
	}, [controlInfo?.type, selectedStepInfo])

	useEffect(() => {
		setSelectedStep((oldStep) => {
			if (actionStepOptions.find((opt) => opt.id === oldStep)) {
				return oldStep
			} else {
				return actionStepOptions[0]?.id
			}
		})
	}, [actionStepOptions])

	useEffect(() => {
		setSelectedSet((oldSet) => {
			if (actionSetOptions.find((opt) => opt.id === oldSet)) {
				return oldSet
			} else {
				return actionSetOptions[0]?.id
			}
		})
	}, [actionSetOptions])

	const gridSize = userConfig?.gridSize

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()

	const gridRef = useRef<ButtonInfiniteGridRef>(null)
	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	return (
		<>
			<div>
				<CButton
					color="light"
					style={{
						float: 'right',
						marginTop: 10,
					}}
					onClick={resetPosition}
				>
					<FontAwesomeIcon icon={faHome} /> Home Position
				</CButton>

				<ButtonGridHeader pageNumber={pageNumber} changePage={changePage} setPage={setPageNumber} />
			</div>
			<div className="buttongrid" ref={isInViewRef}>
				{hasBeenInView && gridSize && (
					<ButtonInfiniteGrid
						ref={gridRef}
						buttonClick={buttonClick}
						pageNumber={pageNumber}
						selectedButton={selectedLocation}
						gridSize={gridSize}
						buttonIconFactory={ButtonGridIcon}
					/>
				)}
			</div>
			<div>
				<CForm className="flex-form" onSubmit={PreventDefaultHandler}>
					<CRow form>
						<CCol sm={10} xs={9} hidden={actionStepOptions.length <= 1}>
							<CLabel>Step</CLabel>

							<DropdownInputField
								choices={actionStepOptions}
								multiple={false}
								value={selectedStep ?? ''}
								setValue={setSelectedStep as (val: DropdownChoiceId) => void}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol sm={10} xs={9} hidden={actionSetOptions.length === 0}>
							<CLabel>Action Group</CLabel>

							<DropdownInputField
								choices={actionSetOptions}
								multiple={false}
								value={selectedSet ?? ''}
								setValue={setSelectedSet as (val: DropdownChoiceId) => void}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol className="py-1" sm={10} xs={9}>
							<CButtonGroup>
								<CButton
									color="primary"
									title="Replace all the actions on the trigger"
									disabled={!selectedControl || !selectedSet}
									onClick={replaceActions}
								>
									Replace
								</CButton>
								<CButton
									color="info"
									title="Append to the existing actions"
									disabled={!selectedControl || !selectedSet}
									onClick={appendActions}
								>
									Append
								</CButton>
							</CButtonGroup>
						</CCol>
					</CRow>
				</CForm>
			</div>
		</>
	)
}
