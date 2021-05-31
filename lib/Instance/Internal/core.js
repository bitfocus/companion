module.export = {
	/**
	 * The core bank controller
	 * @type {BankController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get bank() {
		return this.registry.bank
	},

	/**
	 * The core database library
	 * @type {Database}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get db() {
		return this.registry.db
	},

	/**
	 * The core device controller
	 * @type {DeviceController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get devices() {
		return this.registry.devices
	},

	/**
	 * The core graphics controller
	 * @type {Graphics}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get graphics() {
		return this.registry.graphics
	},

	/**
	 * The core instance controller
	 * @type {InstanceController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get instance() {
		return this.registry.instance
	},

	/**
	 * The core interface client
	 * @type {InterfaceClient}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get io() {
		this.registry.io
	},

	/**
	 * The core page controller
	 * @type {PageController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get page() {
		return this.registry.page
	},

	/**
	 * The core schedule controller
	 * @type {ScheduleController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get schedule() {
		return this.registry.schedule
	},

	/**
	 * The core service controller
	 * @type {ServiceController}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get services() {
		return this.registry.services
	},

	/**
	 * The core user config manager
	 * @type {UserConfig}
	 * @access protected
	 * @memberof InstanceInternal
	 */
	get userconfig() {
		return this.registry.userconfig
	},
}
