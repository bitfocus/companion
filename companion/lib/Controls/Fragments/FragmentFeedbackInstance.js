import { isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'
import LogController from '../../Log/Controller.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'

/**
 * @typedef {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 */

export class FragmentFeedbackInstance {
	/**
	 * The logger
	 * @type {import('winston').Logger}
	 * @access private
	 */
	#logger

	/**
	 * @type {import('../../Instance/Definitions.js').default}
	 * @access private
	 */
	#instanceDefinitions

	/**
	 * @type {import('../../Internal/Controller.js').default}
	 * @access private
	 */
	#internalModule

	/**
	 * @type {import('../../Instance/Host.js').default}
	 * @access private
	 */
	#moduleHost

	/**
	 * Id of the control this belongs to
	 * @type {string}
	 * @access private
	 */
	#controlId

	/**
	 * @type {Omit<FeedbackInstance, 'children'>}
	 * @access private
	 * @readonly
	 */
	#data

	/**
	 * @type {FragmentFeedbackList}
	 */
	#children

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedValue = undefined

	/**
	 * Get the id of this feedback instance
	 * @type {string}
	 */
	get id() {
		return this.#data.id
	}

	get disabled() {
		return this.#data.disabled
	}

	/**
	 * Get the id of the connection this feedback belongs to
	 * @type {string}
	 */
	get connectionId() {
		return this.#data.instance_id
	}

	/**
	 * @type {any}
	 */
	get cachedValue() {
		return this.#cachedValue
	}

	/**
	 * @param {import('../../Instance/Definitions.js').default} instanceDefinitions
	 * @param {import('../../Internal/Controller.js').default} internalModule
	 * @param {import('../../Instance/Host.js').default} moduleHost
	 * @param {string} controlId - id of the control
	 * @param {FeedbackInstance} data
	 * @param {boolean} isCloned Whether this is a cloned instance and should generate new ids
	 */
	constructor(instanceDefinitions, internalModule, moduleHost, controlId, data, isCloned) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Feedbacks/${controlId}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		this.#data = { ...data } // TODO - cleanup unwanted properties
		if (!this.#data.options) this.#data.options = {}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		this.#children = new FragmentFeedbackList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			true
		)
		if (data.instance_id === 'internal' && data.children) {
			this.#children.loadStorage(data.children, true, isCloned)
		}
	}

	/**
	 * Get this feedback as a `FeedbackInstance`
	 * @returns {FeedbackInstance}
	 */
	asFeedbackInstance() {
		return {
			...this.#data,
			children: this.#children.asFeedbackInstances(),
		}
	}

	/**
	 * Get the definition for this feedback
	 * @returns {import('../../Instance/Definitions.js').FeedbackDefinition|undefined}
	 */
	getDefinition() {
		return this.#instanceDefinitions.getFeedbackDefinition(this.#data.instance_id, this.#data.type)
	}

	/**
	 * Get the value of this feedback as a boolean
	 * @returns {boolean}
	 */
	getBooleanValue() {
		if (this.#data.disabled) return false

		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		// TODO building-blocks consider children
		if (this.#data.type === 'logic_and') {
			return this.#children.getBooleanValue()
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
	 * @access public
	 */
	cleanup() {
		// Inform relevant module
		const connection = this.#moduleHost.getChild(this.#data.instance_id, true)
		if (connection) {
			connection.feedbackDelete(this.asFeedbackInstance()).catch((/** @type {any} */ e) => {
				this.#logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		this.#cachedValue = undefined

		this.#children.cleanup()
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param {boolean} recursive whether to call recursively
	 * @param {string=} onlyConnectionId If set, only subscribe feedbacks for this connection
	 * @returns {void}
	 * @access private
	 */
	subscribe(recursive, onlyConnectionId) {
		if (this.#data.disabled) return

		if (!onlyConnectionId || this.#data.instance_id === onlyConnectionId) {
			if (this.#data.instance_id === 'internal') {
				this.#internalModule.feedbackUpdate(this.asFeedbackInstance(), this.#controlId)
			} else {
				const connection = this.#moduleHost.getChild(this.#data.instance_id, true)
				if (connection) {
					connection.feedbackUpdate(this.asFeedbackInstance(), this.#controlId).catch((/** @type {any} */ e) => {
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
	 * @param {boolean} enabled
	 */
	setEnabled(enabled) {
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
	 * @param {string} headline
	 */
	setHeadline(headline) {
		this.#data.headline = headline

		// Don't need to resubscribe
		// Don't need to clear cached value
	}

	/**
	 * Set whether this feedback is inverted
	 * @param {boolean} isInverted
	 */
	setInverted(isInverted) {
		// TODO - verify this is a boolean feedback

		this.#data.isInverted = isInverted

		// Don't need to resubscribe
		// Don't need to clear cached value
	}

	/**
	 * Set the options for this feedback
	 * @param {Record<string, any>} options
	 */
	setOptions(options) {
		this.#data.options = options

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 * @returns {Promise<boolean>}
	 */
	async learnOptions() {
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
	 * @param {string} key
	 * @param {any} value
	 */
	setOption(key, value) {
		this.#data.options[key] = value

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param {string} key the key/name of the property
	 * @param {any} value the new value
	 * @returns {boolean} success
	 */
	setStyleValue(key, value) {
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
		feedback.style[key] = value

		return true
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param {string[]} selected the properties to be selected
	 * @param {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties} baseStyle Style of the button without feedbacks applied
	 * @returns {boolean} success
	 * @access public
	 */
	setStyleSelection(selected, baseStyle) {
		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		/** @type {Partial<import('@companion-module/base').CompanionButtonStyleProps>} */
		const defaultStyle = definition.style || {}
		/** @type {Record<string, any>} */
		const oldStyle = this.#data.style || {}
		/** @type {Record<string, any>} */
		const newStyle = {}

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
	 * @param {any} value
	 */
	setCachedValue(value) {
		if (!isEqual(value, this.#cachedValue)) {
			this.#cachedValue = value
			return true
		} else {
			return false
		}
	}

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @param {string} connectionId
	 * @returns {boolean} Whether a value was changed
	 */
	clearCachedValueForConnectionId(connectionId) {
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
	 * @param {string} id
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	findChildById(id) {
		return this.#children.findById(id)
	}

	// /**
	//  * Find the index of a child feedback, and the parent list
	//  * @param {string} id
	//  * @returns {{ parent: FragmentFeedbackList, index: number, item: FragmentFeedbackInstance } | undefined}
	//  */
	// findParentAndIndex(id) {
	// 	return this.#children.findParentAndIndex(id)
	// }

	/**
	 * Add a child feedback to this feedback
	 * @param {FeedbackInstance} feedback
	 * @returns {FragmentFeedbackInstance}
	 */
	addChild(feedback) {
		if (this.connectionId !== 'internal') {
			throw new Error('Only internal feedbacks can have children')
		}

		return this.#children.addFeedback(feedback)
	}

	/**
	 * Remove a child feedback
	 * @param {string} id
	 * @returns {boolean} success
	 */
	removeChild(id) {
		return this.#children.removeFeedback(id)
	}

	/**
	 * Duplicate a child feedback
	 * @param {string} id
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	duplicateChild(id) {
		return this.#children.duplicateFeedback(id)
	}

	/**
	 * Reorder a feedback in the list
	 * @param {number} oldIndex
	 * @param {number} newIndex
	 */
	moveChild(oldIndex, newIndex) {
		return this.#children.moveFeedback(oldIndex, newIndex)
	}

	/**
	 * Pop a child feedback from the list
	 * Note: this is used when moving a feedback to a different parent. Lifecycle is not managed
	 * @param {number} index
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	popChild(index) {
		return this.#children.popFeedback(index)
	}

	/**
	 * Push a child feedback to the list
	 * Note: this is used when moving a feedback from a different parent. Lifecycle is not managed
	 * @param {FragmentFeedbackInstance} feedback
	 * @param {number} index
	 */
	pushChild(feedback, index) {
		return this.#children.pushFeedback(feedback, index)
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 * @param {string} connectionId
	 * @returns {boolean}
	 */
	forgetChildrenForConnection(connectionId) {
		return this.#children.forgetForConnection(connectionId)
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @param {Set<string>} knownConnectionIds
	 * @access public
	 */
	verifyChildConnectionIds(knownConnectionIds) {
		return this.#children.verifyConnectionIds(knownConnectionIds)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @returns {Promise<void>[]}
	 * @access protected
	 */
	postProcessImport() {
		/** @type {Promise<any>[]} */
		const ps = []

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
	 * @param {Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>} newProps
	 * @access public
	 */
	replaceProps(newProps, skipNotifyModule = false) {
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
}
