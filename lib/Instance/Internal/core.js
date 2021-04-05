module.export = {
	/**
	 * @returns {BankController} the core bank controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	bank() {
		return this.registry.bank
	},

	/**
	 * @returns {Database} the core database library
	 * @access protected
	 * @memberof InstanceInternal
	 */
	db() {
		return this.registry.db
	},

	/**
	 * @returns {DeviceController} the core device controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	deviceController() {
		return this.registry.deviceController
	},

	/**
	 * @returns {Graphics} the core graphics controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	graphics() {
		return this.registry.graphics
	},

	/**
	 * @returns {InstanceController} the core instance controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	instance() {
		return this.registry.instance
	},

	/**
	 * @returns {InterfaceClient} the core interface client
	 * @access protected
	 * @memberof InstanceInternal
	 */
	io() {
		this.registry.io
	},

	/**
	 * @returns {PageController} the core page controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	page() {
		return this.registry.page
	},

	/**
	 * @returns {ScheduleController} the core schedule controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	schedule() {
		return this.registry.schedule
	},

	/**
	 * @returns {ServiceController} the core service controller
	 * @access protected
	 * @memberof InstanceInternal
	 */
	services() {
		return this.registry.services
	},

	/**
	 * @returns {UserConfig} the core user config manager
	 * @access protected
	 * @memberof InstanceInternal
	 */
	userconfig() {
		return this.registry.userconfig
	},
}
