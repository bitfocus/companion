import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import { visitFeedbackInstance } from '../../Resources/Visitors/FeedbackInstanceVisitor.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export class FragmentFeedbackInstance {
	/**
	 * The logger
	 */
	readonly #logger: Logger

	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #data: Omit<FeedbackInstance, 'children'>

	#children: FragmentFeedbackList

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedValue: any = undefined

	/**
	 * Get the id of this feedback instance
	 */
	get id(): string {
		return this.#data.id
	}

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	/**
	 * Get the id of the connection this feedback belongs to
	 */
	get connectionId(): string {
		return this.#data.instance_id
	}

	get cachedValue(): any {
		return this.#cachedValue
	}

	/**
	 * Get a reference to the options for this feedback
	 * Note: This must not be a copy, but the raw object
	 */
	get rawOptions() {
		return this.#data.options
	}

	/**
	 * @param instanceDefinitions
	 * @param internalModule
	 * @param moduleHost
	 * @param controlId - id of the control
	 * @param data
	 * @param isCloned Whether this is a cloned instance and should generate new ids
	 */
	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		data: FeedbackInstance,
		isCloned: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Feedbacks/${controlId}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		this.#data = cloneDeep(data) // TODO - cleanup unwanted properties
		if (!this.#data.options) this.#data.options = {}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		this.#children = new FragmentFeedbackList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			this.id,
			true
		)
		if (data.instance_id === 'internal' && data.children) {
			this.#children.loadStorage(data.children, true, isCloned)
		}
	}

	/**
	 * Get this feedback as a `FeedbackInstance`
	 */
	asFeedbackInstance(): FeedbackInstance {
		return {
			...this.#data,
			children: this.connectionId === 'internal' ? this.#children.asFeedbackInstances() : undefined,
		}
	}

	/**
	 * Get the definition for this feedback
	 */
	getDefinition(): FeedbackDefinition | undefined {
		return this.#instanceDefinitions.getFeedbackDefinition(this.#data.instance_id, this.#data.type)
	}

	/**
	 * Get the value of this feedback as a boolean
	 */
	getBooleanValue(): boolean {
		if (this.#data.disabled) return false

		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		// Special case to handle the internal 'logic' operators, which need to be executed live
		if (this.connectionId === 'internal' && this.#data.type.startsWith('logic_')) {
			// Future: This could probably be made a bit more generic by checking `definition.supportsChildFeedbacks`
			const childValues = this.#children.getChildBooleanValues()

			return this.#internalModule.executeLogicFeedback(this.asFeedbackInstance(), childValues)
		}

		if (typeof this.#cachedValue === 'boolean') {
			if (definition.showInvert && this.#data.isInverted) return !this.#cachedValue

			return this.#cachedValue
		} else {
			// An invalid value is falsey, it probably means that the feedback has no value
			return false
		}
	}

	/**
	 * Inform the instance of a removed feedback
	 */
	cleanup() {
		// Inform relevant module
		const connection = this.#moduleHost.getChild(this.#data.instance_id, true)
		if (connection) {
			connection.feedbackDelete(this.asFeedbackInstance()).catch((e) => {
				this.#logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		this.#cachedValue = undefined

		this.#children.cleanup()
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param recursive whether to call recursively
	 * @param onlyConnectionId If set, only subscribe feedbacks for this connection
	 */
	subscribe(recursive: boolean, onlyConnectionId?: string): void {
		if (this.#data.disabled) return

		if (!onlyConnectionId || this.#data.instance_id === onlyConnectionId) {
			if (this.#data.instance_id === 'internal') {
				this.#internalModule.feedbackUpdate(this.asFeedbackInstance(), this.#controlId)
			} else {
				const connection = this.#moduleHost.getChild(this.#data.instance_id, true)
				if (connection) {
					connection.feedbackUpdate(this.asFeedbackInstance(), this.#controlId).catch((e) => {
						this.#logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}

		if (recursive) {
			this.#children.subscribe(recursive, onlyConnectionId)
		}
	}

	/**
	 * Set whether this feedback is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#data.disabled = !enabled

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		if (!this.#data.disabled) {
			this.subscribe(true)
		} else {
			this.cleanup()
		}
	}

	/**
	 * Set the headline for this feedback
	 */
	setHeadline(headline: string): void {
		this.#data.headline = headline

		// Don't need to resubscribe
		// Don't need to clear cached value
	}

	/**
	 * Set the connection instance of this feedback
	 */
	setInstance(instanceId: string | number): void {
		const instance = `${instanceId}`

		// first unsubscribe feedback from old instance
		this.cleanup()
		// next change instance
		this.#data.instance_id = instance
		// last subscribe to new instance
		this.subscribe(true, instance)
	}

	/**
	 * Set whether this feedback is inverted
	 */
	setInverted(isInverted: boolean): void {
		// TODO - verify this is a boolean feedback

		this.#data.isInverted = isInverted

		// Don't need to resubscribe
		// Don't need to clear cached value
	}

	/**
	 * Set the options for this feedback
	 */
	setOptions(options: Record<string, any>): void {
		this.#data.options = options

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 */
	async learnOptions(): Promise<boolean> {
		const instance = this.#moduleHost.getChild(this.connectionId)
		if (!instance) return false

		const newOptions = await instance.feedbackLearnValues(this.asFeedbackInstance(), this.#controlId)
		if (newOptions) {
			this.setOptions(newOptions)

			return true
		}

		return false
	}

	/**
	 * Set an option for this feedback
	 */
	setOption(key: string, value: any): void {
		this.#data.options[key] = value

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param key the key/name of the property
	 * @param value the new value
	 * @returns success
	 */
	setStyleValue(key: string, value: any): boolean {
		if (key === 'png64' && value !== null) {
			if (!value.match(/data:.*?image\/png/)) {
				return false
			}

			value = value.replace(/^.*base64,/, '')
		}

		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		if (!this.#data.style) this.#data.style = {}
		// @ts-ignore
		this.#data.style[key] = value

		return true
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param selected the properties to be selected
	 * @param baseStyle Style of the button without feedbacks applied
	 * @returns success
	 * @access public
	 */
	setStyleSelection(selected: string[], baseStyle: ButtonStyleProperties): boolean {
		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		const defaultStyle: Partial<CompanionButtonStyleProps> = definition.style || {}
		const oldStyle: Record<string, any> = this.#data.style || {}
		const newStyle: Record<string, any> = {}

		for (const key of selected) {
			if (key in oldStyle) {
				// preserve existing value
				newStyle[key] = oldStyle[key]
			} else {
				// copy button value as a default
				// @ts-ignore
				newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : baseStyle[key]

				// png needs to be set to something harmless
				if (key === 'png64' && !newStyle[key]) {
					newStyle[key] = null
				}
			}

			if (key === 'text') {
				// also preserve textExpression
				newStyle['textExpression'] =
					oldStyle['textExpression'] ??
					/*defaultStyle['textExpression'] !== undefined
								? defaultStyle['textExpression']
								: */ baseStyle['textExpression']
			}
		}
		this.#data.style = newStyle

		return true
	}

	/**
	 * Set the cached value of this feedback
	 */
	setCachedValue(value: any): boolean {
		if (!isEqual(value, this.#cachedValue)) {
			this.#cachedValue = value
			return true
		} else {
			return false
		}
	}

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @returns Whether a value was changed
	 */
	clearCachedValueForConnectionId(connectionId: string): boolean {
		let changed = false

		if (this.#data.instance_id === connectionId) {
			this.#cachedValue = undefined

			changed = true
		}

		if (this.#children.clearCachedValueForConnectionId(connectionId)) {
			changed = true
		}

		return changed
	}

	/**
	 * Find a child feedback by id
	 */
	findChildById(id: string): FragmentFeedbackInstance | undefined {
		return this.#children.findById(id)
	}

	/**
	 * Find the index of a child feedback, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentFeedbackList; index: number; item: FragmentFeedbackInstance } | undefined {
		return this.#children.findParentAndIndex(id)
	}

	/**
	 * Add a child feedback to this feedback
	 */
	addChild(feedback: FeedbackInstance): FragmentFeedbackInstance {
		if (this.connectionId !== 'internal') {
			throw new Error('Only internal feedbacks can have children')
		}

		return this.#children.addFeedback(feedback)
	}

	/**
	 * Remove a child feedback
	 */
	removeChild(id: string): boolean {
		return this.#children.removeFeedback(id)
	}

	/**
	 * Duplicate a child feedback
	 */
	duplicateChild(id: string): FragmentFeedbackInstance | undefined {
		return this.#children.duplicateFeedback(id)
	}

	/**
	 * Reorder a feedback in the list
	 */
	moveChild(oldIndex: number, newIndex: number): void {
		return this.#children.moveFeedback(oldIndex, newIndex)
	}

	/**
	 * Pop a child feedback from the list
	 * Note: this is used when moving a feedback to a different parent. Lifecycle is not managed
	 */
	popChild(index: number): FragmentFeedbackInstance | undefined {
		return this.#children.popFeedback(index)
	}

	/**
	 * Push a child feedback to the list
	 * Note: this is used when moving a feedback from a different parent. Lifecycle is not managed
	 */
	pushChild(feedback: FragmentFeedbackInstance, index: number): void {
		return this.#children.pushFeedback(feedback, index)
	}

	/**
	 * Check if this list can accept a specified child
	 */
	canAcceptChild(feedback: FragmentFeedbackInstance): boolean {
		return this.#children.canAcceptFeedback(feedback)
	}

	/**
	 * Recursively get all the feedbacks
	 */
	getAllChildren(): FragmentFeedbackInstance[] {
		return this.#children.getAllFeedbacks()
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 */
	forgetChildrenForConnection(connectionId: string): boolean {
		return this.#children.forgetForConnection(connectionId)
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyChildConnectionIds(knownConnectionIds: Set<string>): boolean {
		return this.#children.verifyConnectionIds(knownConnectionIds)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): Promise<void>[] {
		const ps: Promise<void>[] = []

		if (this.#data.instance_id === 'internal') {
			const newProps = this.#internalModule.feedbackUpgrade(this.asFeedbackInstance(), this.#controlId)
			if (newProps) {
				this.replaceProps(newProps, false)
			}

			setImmediate(() => {
				this.#internalModule.feedbackUpdate(this.asFeedbackInstance(), this.#controlId)
			})
		} else {
			const instance = this.#moduleHost.getChild(this.connectionId, true)
			if (instance) {
				ps.push(instance.feedbackUpdate(this.asFeedbackInstance(), this.#controlId))
			}
		}

		ps.push(...this.#children.postProcessImport())

		return ps
	}

	/**
	 * Replace portions of the feedback with an updated version
	 */
	replaceProps(
		newProps: Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>,
		skipNotifyModule = false
	): void {
		this.#data.type = newProps.type // || newProps.feedbackId
		this.#data.options = newProps.options
		this.#data.isInverted = !!newProps.isInverted

		delete this.#data.upgradeIndex

		// Preserve existing value if it is set
		this.#data.style = Object.keys(this.#data.style || {}).length > 0 ? this.#data.style : newProps.style

		if (!skipNotifyModule) {
			this.subscribe(false)
		}
	}

	/**
	 * Visit any references in the current feedback
	 */
	visitReferences(visitor: InternalVisitor): void {
		visitFeedbackInstance(visitor, this.#data)
	}
}
