/**
 * A base item definition
 * @abstract
 */
class BankItemDefinition {
	/** @type {string} */
	label
	/** @type {CompanionInputField[]} */
	options
}

/**
 * An action definition from an instance
 * @extends BankItemDefinition
 */
class BankActionDefinition extends BankItemDefinition {
	/**
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @param {BankActionEventInfo} info
	 * @returns {void}
	 */
	callback(action, info) {}
	/**
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @returns {void}
	 */
	subscribe(action) {}
	/**
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @returns {void}
	 */
	unsubscribe(action) {}
}

/**
 * A feedback definition from an instance
 * @extends BankItemDefinition
 */
class BankFeedbackDefinition extends BankItemDefinition {
	/** @type {?string} */
	description
	/**
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {BankStyle}
	 */
	callback(feedback) {}
	/**
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {void}
	 */
	subscribe(feedback) {}
	/**
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {void}
	 */
	unsubscribe(feedback) {}
}

class BankItem {
	/** @type {string} */
	id
	/** @type {string} */
	label
	/** @type {string} */
	type
	/** @type {string} */
	instance
	/** @type {Object.<string,(number|string|boolean|undefined)>} */
	options
}

class BankActionItem extends BankItem {
	/**
	 * Copy of type for backward compatibility
	 * @type {?string}
	 */
	action
}

class BankFeedbackItem extends BankItem {
	/**
	 * Copy of instance for backward compability
	 * @type {?string}
	 */
	instance_id
}

class BankActionEventInfo {
	/** @type {?string} */
	deviceId
	/** @type {number} */
	page
	/** @type {number} */
	bank
}

/**
 * A style definition for a bank
 */
class BankStyle {
	/**
	 * "(left|center|right):(top|center|bottom)"
	 * @type {?string}
	 * */
	alignment
	/** @type {?string} */
	base64
	/** @type {?number} */
	bgcolor
	/** @type {?number} */
	color
	/**
	 * "(left|center|right):(top|center|bottom)"
	 * @type {?string}
	 * */
	pngalignment
	/** @type {?string} */
	png64
	/**
	 * (auto|7|14|18|24||30|44))
	 *  @type {?string}
	 */
	size
	/** @type {?string} */
	text
}

exports = module.exports = {
	BankActionDefinition,
	BankItemDefinition,
	BankFeedbackDefinition,
	BankItem,
	BankActionItem,
	BankFeedbackItem,
	BankActionEventInfo,
	BankStyle,
}
