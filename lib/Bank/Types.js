class BankItemDefinition {
	/** @type {string} */
	label;
	/** @type {CompanionInputField[]} */
	options;
}

class BankActionDefinition extends BankItemDefinition {
	/** 
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @param {BankActionEventInfo} info
	 * @returns {void}
	 */
	callback;
	/** 
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @returns {void}
	 */
	subscribe;
	/** 
	 * @type {?function}
	 * @param {BankActionItem} action
	 * @returns {void}
	 */
	unsubscribe;
}

class BankFeedbackDefinition extends BankItemDefinition {
	/** @type {?string} */
	description;
	/** 
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {BankFeedbackResult}
	 */
	callback;
	/** 
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {void}
	 */
	subscribe;
	/** 
	 * @type {?function}
	 * @param {BankFeedbackItem} feedback
	 * @returns {void}
	 */
	unsubscribe;
}

class BankItem {
	/** @type {string} */
	id;
	/** @type {string} */
	label;
	/** @type {string} */
	type;
	/** @type {string} */
	instance;
	/** @type {Object.<string,(number|string|boolean|undefined)>} */
	options;
}

class BankActionItem extends BankItem {
	/**
	 * Copy of type for backward compatibility
	 * @type {?string}
	 */
	action;
}

class BankFeedbackItem extends BankItem {
	/**
	 * Copy of instance for backward compability
	 * @type {?string}
	 */
	instance_id;
}

class BankActionEventInfo {
	/** @type {?string} */
	deviceId;
	/** @type {number} */
	page;
	/** @type {number} */
	bank;
}

class BankFeedbackResult {
	/**
	 * ( left|center|right):(top|center|bottom)
	 * @type {?string}
	 * */
	alignment;
	/** @type {?string} */
	base64;
	/** @type {?number} */
	bgcolor;
	/** @type {?number} */
	color;
	/**
	 * (left|center|right):(top|center|bottom)
	 * @type {?string}
	 * */
	pngalignment;
	/** @type {?string} */
	png64;
	/**
	 * (auto|7|14|18|24||30|44))
	 *  @type {?string}  
	 */
	size;
	/** @type {?string} */
	text;
}

exports = module.exports = {
	BankActionDefinition,
	BankItemDefinition,
	BankFeedbackDefinition,
	BankItem,
	BankActionItem,
	BankFeedbackItem,
	BankActionEventInfo,
	BankFeedbackResult
}