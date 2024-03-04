import {
	CDropdown,
	CDropdownToggle,
	CDropdownItem,
	CDropdownMenu,
	CButton,
	CButtonGroup,
	CModal,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CForm,
	CFormGroup,
	CLabel,
	CInput,
	CNavItem,
	CNavLink,
	CNav,
	CTabs,
} from '@coreui/react'
import {
	faChevronLeft,
	faChevronRight,
	faPencil,
	faPlay,
	faPlus,
	faRedo,
	faTrash,
	faTrashAlt,
	faUndo,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, {
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	useMemo,
	FormEvent,
	useReducer,
} from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreviewBase } from '../Components/ButtonPreview.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { KeyReceiver, LoadingRetryOrError, socketEmitPromise, SocketContext, MyErrorBoundary, CompanionSocketType } from '../util.js'
import { ControlActionSetEditor } from '../Controls/ActionSetEditor.js'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { ButtonStyleConfig } from '../Controls/ButtonStyleConfig.js'
import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor.js'
import { ControlFeedbacksEditor } from '../Controls/FeedbackEditor.js'
import { cloneDeep } from 'lodash-es'
import { useElementSize } from 'usehooks-ts'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import CSwitch from '../CSwitch.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ActionInstance, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { NormalButtonSteps, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export const EditButton = observer(function EditButton({ location, onKeyUp }: EditButtonProps) {
	const { socket, pages } = useContext(RootAppStoreContext)

	const controlId = pages.getControlIdAtLocation(location)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [config, setConfig] = useState<SomeButtonModel | null | false>(null)
	const [runtimeProps, setRuntimeProps] = useState<Record<string, any> | null | false>(null)

	const configRef = useRef<SomeButtonModel>()
	configRef.current = config || undefined // update the ref every render

	const [configError, setConfigError] = useState<string | null>(null)

	const [reloadConfigToken, setReloadConfigToken] = useState(nanoid())

	useEffect(() => {
		if (!controlId) {
			setConfig(false)
			setRuntimeProps({})
			setConfigError(null)
			setPreviewImage(null)

			return
		}

		setConfig(null)
		setConfigError(null)
		setPreviewImage(null)
		setRuntimeProps(null)

		socketEmitPromise(socket, 'controls:subscribe', [controlId])
			.then((config) => {
				console.log(config)
				setConfig((config as any)?.config ?? false)
				setRuntimeProps(config?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load control config', e)
				setConfig(null)
				setConfigError('Failed to load control config')
			})

		const patchConfig = (patch: JsonPatchOperation[] | false) => {
			setConfig((oldConfig) => {
				if (!oldConfig) return oldConfig
				if (patch === false) {
					return false
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig), patch).newDocument
				}
			})
		}

		const patchRuntimeProps = (patch: JsonPatchOperation[] | false) => {
			setRuntimeProps((oldProps) => {
				if (!oldProps) return oldProps
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps), patch).newDocument
				}
			})
		}

		socket.on(`controls:config-${controlId}`, patchConfig)
		socket.on(`controls:runtime-${controlId}`, patchRuntimeProps)

		const updateImage = (img: string | null) => {
			setPreviewImage(img)
		}
		socket.on(`controls:preview-${controlId}`, updateImage)

		return () => {
			socket.off(`controls:config-${controlId}`, patchConfig)
			socket.off(`controls:runtime-${controlId}`, patchRuntimeProps)
			socket.off(`controls:preview-${controlId}`, updateImage)

			socketEmitPromise(socket, 'controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const setButtonType = useCallback(
		(newType: string) => {
			let show_warning = false

			const currentType = configRef.current?.type
			if (currentType === newType) {
				// No point changing style to itself
				return
			}

			if (currentType && currentType !== 'pageup' && currentType !== 'pagedown' && currentType !== 'pagenum') {
				if (newType === 'pageup' || newType === 'pagedown' || newType === 'pagenum') {
					show_warning = true
				}
			}

			const doChange = () => {
				socketEmitPromise(socket, 'controls:reset', [location, newType]).catch((e) => {
					console.error(`Set type failed: ${e}`)
				})
			}

			if (show_warning) {
				resetModalRef.current?.show(
					`Change style`,
					`Changing to this button style will erase actions and feedbacks configured for this button - continue?`,
					'OK',
					() => {
						doChange()
					}
				)
			} else {
				doChange()
			}
		},
		[socket, location, configRef]
	)

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])
	const clearButton = useCallback(() => {
		resetModalRef.current?.show(
			`Clear button ${formatLocation(location)}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				socketEmitPromise(socket, 'controls:reset', [location]).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [socket, location])

	const hotPressDown = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-press', [location, true, 'edit']).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, location])
	const hotPressUp = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-press', [location, false, 'edit']).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, location])
	const hotRotateLeft = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-rotate', [location, false, 'edit']).catch((e) =>
			console.error(`Hot rotate failed: ${e}`)
		)
	}, [socket, location])
	const hotRotateRight = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-rotate', [location, true, 'edit']).catch((e) =>
			console.error(`Hot rotate failed: ${e}`)
		)
	}, [socket, location])

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasConfig = !!config || config === false
	const hasRuntimeProps = !!runtimeProps || runtimeProps === false
	const dataReady = !loadError && hasConfig && hasRuntimeProps

	// Tip: This query needs to match the page layout. It doesn't need to be reactive, as the useElementSize will force a re-render
	// const isTwoColumn = window.matchMedia('(min-width: 1200px)').matches
	// const [, { height: hintHeight }] = useElementSize()

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{hasConfig && dataReady && (
				<>
					<ButtonPreviewBase fixedSize preview={previewImage} right={true} />
					{(!config || config.type === undefined) && (
						<MyErrorBoundary>
							{' '}
							<CDropdown className="" style={{ display: 'inline-block', marginRight: -4 }}>
								<CButtonGroup>
									{/* This could be simplified to use the split property on CDropdownToggle, but then onClick doesnt work https://github.com/coreui/coreui-react/issues/179 */}
									<CButton color="danger" onClick={() => setButtonType('button')}>
										Create button
									</CButton>
									<CDropdownToggle
										caret
										color="danger"
										style={{ opacity: 0.7, paddingLeft: 14, paddingRight: 16 }}
										className="dropdown-toggle dropdown-toggle-split"
									>
										<span className="sr-only">Toggle Dropdown</span>
									</CDropdownToggle>
								</CButtonGroup>
								<CDropdownMenu>
									<CDropdownItem onClick={() => setButtonType('button')}>Regular button</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pageup')}>Page up</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagenum')}>Page number</CDropdownItem>
									<CDropdownItem onClick={() => setButtonType('pagedown')}>Page down</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
						</MyErrorBoundary>
					)}
					&nbsp;
					<MyErrorBoundary>
						<CButton color="danger" hidden={!config} onClick={clearButton} title="Clear Button">
							<FontAwesomeIcon icon={faTrashAlt} />
						</CButton>
						&nbsp;
						<CButtonGroup>
							<CButton
								color="warning"
								hidden={!config || config.type !== 'button'}
								onMouseDown={hotPressDown}
								onMouseUp={hotPressUp}
								style={{ color: 'white' }}
								title="Test press button"
							>
								<FontAwesomeIcon icon={faPlay} />
								&nbsp;Test
							</CButton>
						</CButtonGroup>{' '}
					</MyErrorBoundary>
					&nbsp;
					{config && 'options' in config && config?.options?.rotaryActions && (
						<MyErrorBoundary>
							<CButton color="warning" onMouseDown={hotRotateLeft} style={{ color: 'white' }} title="Test rotate left">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
							&nbsp;
							<CButton
								color="warning"
								onMouseDown={hotRotateRight}
								style={{ color: 'white' }}
								title="Test rotate right"
							>
								<FontAwesomeIcon icon={faRedo} />
							</CButton>
						</MyErrorBoundary>
					)}
					{!config && (
						<>
							<h4>Empty button</h4>
							<p className="mt-3">
								To get started, click button above to create a regular button, or use the drop down to make a special
								button.
							</p>
						</>
					)}
					{controlId && config && (
						<MyErrorBoundary>
							<ButtonStyleConfig
								controlType={config.type}
								style={'style' in config ? config.style : undefined}
								configRef={configRef}
								controlId={controlId}
								mainDialog
							/>
						</MyErrorBoundary>
					)}
					{controlId && config && config.type === 'button' && (
						<>
							<MyErrorBoundary>
								<div style={{ marginLeft: '5px' }}>
									<ControlOptionsEditor
										controlType={config.type}
										options={config.options}
										configRef={configRef}
										controlId={controlId}
									/>
								</div>
							</MyErrorBoundary>
							{runtimeProps && (
								<MyErrorBoundary>
									<TabsSection
										style={config.type}
										location={location}
										controlId={controlId}
										steps={config.steps || {}}
										runtimeProps={runtimeProps}
										rotaryActions={config?.options?.rotaryActions}
										feedbacks={config.feedbacks}
									/>
								</MyErrorBoundary>
							)}
						</>
					)}
				</>
			)}
		</KeyReceiver>
	)
})

interface TabsSectionProps {
	style: 'button' | 'pageup' | 'pagenum' | 'pagedown'
	controlId: string
	location: ControlLocation
	steps: NormalButtonSteps
	runtimeProps: Record<string, any>
	rotaryActions: boolean
	feedbacks: FeedbackInstance[]
}

interface TabStepProps{
	selectedKey: string | false
	k: string | number
	name:string|number
	inputState: {showInputEle:boolean}
	linkClassname: string | undefined
	socket: CompanionSocketType
	controlId: string

}
function TabStep({selectedKey, k, name, inputState, linkClassname, socket, controlId }: TabStepProps){
	const renameStep = useCallback(
		(stepId: string, newName: string) => {
			socketEmitPromise(socket, 'controls:step:rename', [controlId, stepId, newName]).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[socket, controlId]
	)
	
	function onChangeHandler(e: React.ChangeEvent<HTMLInputElement>){
		setState({showInputEle: state.showInputEle});
		if(selectedKey){
			renameStep(selectedKey, e.target.value);
		}
	}

	const [state, setState] = useState(inputState);
	return (
		<CNavItem key={k} className="nav-steps-special">
			{state.showInputEle? (
				<input
					type="text"
					value={name}
					onChange={(e)=>{onChangeHandler(e)}}
					onBlur={(e)=>setState({showInputEle: false})}
					autoFocus
				>			
				</input>
			) : (
				<CNavLink onDoubleClick={(e)=>setState({showInputEle: true})} data-tab={`step:${k}`} className={linkClassname}>
					{name}
				</CNavLink>
		)}	
		</CNavItem>
	);
}

function TabsSection({ style, controlId, location, steps, runtimeProps, rotaryActions, feedbacks }: TabsSectionProps) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const tabsScrollRef = useRef(null)
	const [tabsSizeRef] = useElementSize()

	const setTabsRef = useCallback(
		(ref) => {
			tabsSizeRef(ref)
			tabsScrollRef.current = ref
		},
		[tabsSizeRef]
	)

	const clickSelectedStep = useCallback((newStep: string) => {
		setSelectedStep(newStep)

		// Let's reactivate this again if users start setting cars on fire because I removed it. -wv
		/* 
		if (tabsScrollRef.current) {
			tabsScrollRef.current.scrollIntoView({
				block: 'start',
				inline: 'nearest',
				behavior: 'smooth',
			})
		}
		*/
	}, [])

	const keys = useMemo(() => GetStepIds(steps), [steps])
	const [selectedStep, setSelectedStep] = useState(keys.length ? `step:${keys[0]}` : 'feedbacks')

	useEffect(() => {
		const keys2 = keys.map((k) => `step:${k}`)
		keys2.push('feedbacks')

		if (!keys2.includes(selectedStep)) {
			setSelectedStep(keys2[0])
		}
	}, [keys, selectedStep])

	const appendStep = useCallback(
		(e: FormEvent) => {
			if (e) e.preventDefault()

			socketEmitPromise(socket, 'controls:step:add', [controlId])
				.then((newStep) => {
					if (newStep) {
						setSelectedStep(`step:${newStep}`)
						setTimeout(() => setSelectedStep(`step:${newStep}`), 500)
					}
				})
				.catch((e) => {
					console.error('Failed to append step:', e)
				})
		},
		[socket, controlId]
	)
	const removeStep = useCallback(
		(stepId: string) => {
			confirmRef.current?.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socketEmitPromise(socket, 'controls:step:remove', [controlId, stepId]).catch((e) => {
					console.error('Failed to delete step:', e)
				})
			})
		},
		[socket, controlId]
	)
	const swapSteps = useCallback(
		(stepId1: string, stepId2: string) => {
			socketEmitPromise(socket, 'controls:step:swap', [controlId, stepId1, stepId2])
				.then(() => {
					setSelectedStep(`step:${stepId2}`)
				})
				.catch((e) => {
					console.error('Failed to swap steps:', e)
				})
		},
		[socket, controlId]
	)
	const setCurrentStep = useCallback(
		(stepId: string) => {
			socketEmitPromise(socket, 'controls:step:set-current', [controlId, stepId]).catch((e) => {
				console.error('Failed to set step:', e)
			})
		},
		[socket, controlId]
	)
	const renameStep = useCallback(
		(stepId: string, newName: string) => {
			socketEmitPromise(socket, 'controls:step:rename', [controlId, stepId, newName]).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[socket, controlId]
	)

	const appendSet = useCallback(
		(stepId: string) => {
			socketEmitPromise(socket, 'controls:action-set:add', [controlId, stepId]).catch((e) => {
				console.error('Failed to append set:', e)
			})
		},
		[socket, controlId]
	)
	const removeSet = useCallback(
		(stepId: string, setId: string | number) => {
			confirmRef.current?.show('Remove set', 'Are you sure you wish to remove this group?', 'Remove', () => {
				socketEmitPromise(socket, 'controls:action-set:remove', [controlId, stepId, setId + '']).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[socket, controlId]
	)

	if (style === 'button') {
		const selectedIndex = keys.findIndex((k) => `step:${k}` === selectedStep)
		const selectedKey = selectedIndex >= 0 && keys[selectedIndex]
		const selectedStep2 = selectedKey ? steps[selectedKey] : undefined

		return (
			<div key="button">
				<GenericConfirmModal ref={confirmRef} />

				<br />

				<div ref={setTabsRef} className={'row-heading'}>
					<CTabs activeTab={selectedStep} onActiveTabChange={clickSelectedStep}>
						<CNav variant="tabs">
							{keys.map((k: string | number, i) => {
								let linkClassname: string | undefined = undefined

								// if there's more than one step, we need to show the current step
								const moreThanOneStep = keys.length > 1
								// the current step is the one that is currently being executed
								const isCurrent = runtimeProps.current_step_id === k
								// both selected and the current step
								const isActiveAndCurrent = k === selectedIndex && runtimeProps.current_step_id === k

								const name = steps[k]?.name;

								if (moreThanOneStep) {
									if (isActiveAndCurrent) linkClassname = 'selected-and-active'
									else if (isCurrent) linkClassname = 'only-current'
								}

								return (
									<TabStep selectedKey={selectedKey} k={k} name={name && name !== "" ? name : (i === 0 ? (keys.length > 1 ? 'Step ' + (i + 1) : 'Actions') : i + 1)}inputState={{showInputEle:false}} linkClassname={linkClassname} socket={socket} controlId={controlId} ></TabStep>
								)
							})}

							<CNavItem key="feedbacks" className="nav-steps-special">
								<CNavLink data-tab="feedbacks">Feedbacks</CNavLink>
							</CNavItem>
							{keys.length === 1 && (
								<CNavItem key="add-step" className="nav-steps-special">
									<CNavLink onClick={appendStep}>
										<FontAwesomeIcon icon={faPlus} /> Add step
									</CNavLink>
								</CNavItem>
							)}
						</CNav>
					</CTabs>
				</div>

				<div
					className="edit-sticky-body"
					style={
						{
							// minHeight: `calc(${contentHeight - tabsHeight}px - 1rem`,
						}
					}
				>
					<p></p>
					{selectedKey && <input onChange={(e) => renameStep(selectedKey, e.target.value)} placeholder='Rename step'></input>}
					{selectedStep === 'feedbacks' && (
						<MyErrorBoundary>
							<ControlFeedbacksEditor
								heading="Feedbacks"
								entityType="feedback"
								controlId={controlId}
								feedbacks={feedbacks}
								location={location}
								booleanOnly={false}
								addPlaceholder="+ Add feedback"
							/>
						</MyErrorBoundary>
					)}

					{selectedKey && selectedStep && (
						<>
							<CButtonGroup hidden={keys.length === 1}>
								<CButton
									color="danger"
									title="Move step before"
									disabled={selectedIndex === 0}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex - 1])}
								>
									<FontAwesomeIcon icon={faChevronLeft} />
								</CButton>
								<CButton
									color="danger"
									title="Move step after"
									disabled={selectedIndex === keys.length - 1}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex + 1])}
								>
									<FontAwesomeIcon icon={faChevronRight} />
								</CButton>

								<CButton
									color="success"
									style={{ fontWeight: 'bold', opacity: runtimeProps.current_step_id === selectedKey ? 0.3 : 1 }}
									disabled={runtimeProps.current_step_id === selectedKey}
									onClick={() => setCurrentStep(selectedKey)}
								>
									Select
								</CButton>
								<CButton
									style={{ backgroundColor: '#f0f0f0', marginRight: 1 }}
									title="Add step"
									disabled={keys.length === 1}
									onClick={appendStep}
								>
									<FontAwesomeIcon icon={faPlus} />
								</CButton>
								<CButton
									style={{ backgroundColor: '#f0f0f0' }}
									title="Delete step"
									disabled={keys.length === 1}
									onClick={() => removeStep(selectedKey)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</CButtonGroup>

							{rotaryActions && selectedStep2 && (
								<>
									<MyErrorBoundary>
										<ControlActionSetEditor
											heading="Rotate left actions"
											controlId={controlId}
											location={location}
											stepId={selectedKey}
											setId="rotate_left"
											addPlaceholder="+ Add rotate left action"
											actions={selectedStep2.action_sets['rotate_left']}
										/>
									</MyErrorBoundary>

									<MyErrorBoundary>
										<ControlActionSetEditor
											heading="Rotate right actions"
											controlId={controlId}
											location={location}
											stepId={selectedKey}
											setId="rotate_right"
											addPlaceholder="+ Add rotate right action"
											actions={selectedStep2.action_sets['rotate_right']}
										/>
									</MyErrorBoundary>
								</>
							)}

							{selectedStep2 && (
								<>
									<MyErrorBoundary>
										<ControlActionSetEditor
											heading={`Press actions`}
											controlId={controlId}
											location={location}
											stepId={selectedKey}
											setId="down"
											addPlaceholder={`+ Add press action`}
											actions={selectedStep2.action_sets['down']}
										/>
									</MyErrorBoundary>

									<EditActionsRelease
										controlId={controlId}
										location={location}
										action_sets={selectedStep2.action_sets}
										stepOptions={selectedStep2.options}
										stepId={selectedKey}
										removeSet={removeSet}
									/>
								</>
							)}

							<br />
							<p>
								<CButton onClick={() => appendSet(selectedKey)} color="primary">
									<FontAwesomeIcon icon={faPlus} /> Add duration group
								</CButton>
							</p>
						</>
					)}
				</div>
			</div>
		)
	} else {
		return <div key="else"></div>
	}
}

interface EditActionsReleaseProps {
	controlId: string
	location: ControlLocation
	action_sets: ActionSetsModel
	stepOptions: ActionStepOptions
	stepId: string
	removeSet: (stepId: string, setId: string | number) => void
}

function EditActionsRelease({
	controlId,
	location,
	action_sets,
	stepOptions,
	stepId,
	removeSet,
}: EditActionsReleaseProps) {
	const socket = useContext(SocketContext)

	const editRef = useRef<EditDurationGroupPropertiesModalRef>(null)

	const configureSet = useCallback(
		(oldId: string | number) => {
			if (editRef.current) {
				const oldIdNumber = Number(oldId)
				if (isNaN(oldIdNumber)) return

				const runWhileHeld = stepOptions.runWhileHeld.includes(oldIdNumber)
				editRef.current?.show(oldIdNumber, runWhileHeld, (newId: number, runWhileHeld: boolean) => {
					if (!isNaN(newId)) {
						socketEmitPromise(socket, 'controls:action-set:rename', [controlId, stepId, oldIdNumber + '', newId + ''])
							.then(() => {
								socketEmitPromise(socket, 'controls:action-set:set-run-while-held', [
									controlId,
									stepId,
									newId + '',
									runWhileHeld,
								]).catch((e) => {
									console.error('Failed to set runWhileHeld:', e)
								})
							})
							.catch((e) => {
								console.error('Failed to rename set:', e)
							})
					}
				})
			}
		},
		[socket, controlId, stepId, stepOptions]
	)

	const candidate_sets = Object.entries(action_sets)
		.map((o): [number, ActionInstance[] | undefined] => [Number(o[0]), o[1]])
		.filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => a[0] - b[0])

	const components = candidate_sets.map(([id, actions]) => {
		const runWhileHeld = stepOptions.runWhileHeld.includes(Number(id))
		const ident = runWhileHeld ? `Held for ${id}ms` : `Release after ${id}ms`
		return (
			<MyErrorBoundary key={id}>
				<ControlActionSetEditor
					key={id}
					heading={`${ident} actions`}
					headingActions={[
						<CButton key="rename" color="white" title="Configure" size="sm" onClick={() => configureSet(id)}>
							<FontAwesomeIcon icon={faPencil} />
						</CButton>,
						<CButton key="delete" color="white" title="Delete step" size="sm" onClick={() => removeSet(stepId, id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>,
					]}
					controlId={controlId}
					location={location}
					stepId={stepId}
					setId={id}
					addPlaceholder={`+ Add ${ident} action`}
					actions={actions}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationGroupPropertiesModal ref={editRef} />

			<MyErrorBoundary>
				<ControlActionSetEditor
					heading={candidate_sets.length ? 'Short release actions' : 'Release actions'}
					controlId={controlId}
					location={location}
					stepId={stepId}
					setId={'up'}
					addPlaceholder={candidate_sets.length ? '+ Add key short release action' : '+ Add key release action'}
					actions={action_sets['up']}
				/>
			</MyErrorBoundary>

			{components}
		</>
	)
}

type EditDurationCompleteCallback = (duration: number, whileHeld: boolean) => void

interface EditDurationGroupPropertiesModalRef {
	show(duration: number, whileHeld: boolean, completeCallback: EditDurationCompleteCallback): void
}

interface EditDurationGroupPropertiesModalProps {
	// Nothing
}

const EditDurationGroupPropertiesModal = forwardRef<
	EditDurationGroupPropertiesModalRef,
	EditDurationGroupPropertiesModalProps
>(function EditDurationGroupPropertiesModal(_props, ref) {
	const [data, setData] = useState<[number, EditDurationCompleteCallback] | null>(null)
	const [show, setShow] = useState(false)

	const [newDurationValue, setNewDurationValue] = useState<number | null>(null)
	const [newWhileHeldValue, setNewWhileHeldValue] = useState<boolean | null>(null)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const buttonFocus = () => {
		buttonRef.current?.focus()
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doAction = useCallback(
		(e: FormEvent) => {
			if (e) e.preventDefault()

			setData(null)
			setShow(false)
			setNewDurationValue(null)
			setNewWhileHeldValue(null)

			// completion callback
			const cb = data?.[1]
			if (!cb || newDurationValue === null || newWhileHeldValue === null) return
			cb(newDurationValue, newWhileHeldValue)
		},
		[data, newDurationValue, newWhileHeldValue]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(duration, whileHeld, completeCallback) {
				setNewDurationValue(duration)
				setNewWhileHeldValue(whileHeld)
				setData([duration, completeCallback])
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	const onDurationChange = useCallback((e) => {
		setNewDurationValue(Number(e.target.value))
	}, [])

	const onWhileHeldChange = useCallback((e) => {
		setNewWhileHeldValue(!!e.target.checked)
	}, [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>Change delay group properties</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={doAction}>
					<CFormGroup>
						<CLabel>Press duration</CLabel>
						<CInput
							type="number"
							value={newDurationValue || ''}
							min={1}
							step={1}
							style={{ color: !newDurationValue || newDurationValue <= 0 ? 'red' : undefined }}
							onChange={onDurationChange}
						/>
					</CFormGroup>

					<CFormGroup>
						<CLabel>Execute while held</CLabel>
						<p>
							<CSwitch color="success" checked={!!newWhileHeldValue} onChange={onWhileHeldChange} />
						</p>
					</CFormGroup>
				</CForm>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
					Save
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
