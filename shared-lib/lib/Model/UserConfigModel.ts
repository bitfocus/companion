export interface UserConfigModel {
	setup_wizard: number

	page_direction_flipped: boolean
	page_plusminus: boolean
	remove_topbar: boolean

	xkeys_enable: boolean
	elgato_plugin_enable: boolean // Also disables local streamdeck
	usb_hotplug: boolean
	loupedeck_enable: boolean
	mirabox_streamdock_enable: boolean
	contour_shuttle_enable: boolean
	vec_footpedal_enable: boolean
	blackmagic_controller_enable: boolean
	mystrix_enable: boolean
	logitech_mx_console_enable: boolean

	pin_enable: boolean
	link_lockouts: boolean
	pin: string
	pin_timeout: number

	http_api_enabled: boolean
	http_legacy_api_enabled: boolean

	tcp_enabled: boolean
	tcp_listen_port: number
	tcp_legacy_api_enabled: boolean

	udp_enabled: boolean
	udp_listen_port: number
	udp_legacy_api_enabled: boolean

	osc_enabled: boolean
	osc_listen_port: number
	osc_legacy_api_enabled: boolean

	rosstalk_enabled: boolean

	emberplus_enabled: boolean

	videohub_panel_enabled: boolean

	artnet_enabled: boolean
	artnet_universe: number
	artnet_channel: number

	https_enabled: boolean
	https_port: number
	https_cert_type: string
	https_self_cn: string
	https_self_expiry: number
	https_self_cert: string
	https_self_cert_created: string
	https_self_cert_cn: string
	https_self_cert_expiry: string
	https_self_cert_private: string
	https_self_cert_public: string
	https_ext_private_key: string
	https_ext_certificate: string
	https_ext_chain: string

	admin_lockout: boolean
	admin_timeout: number
	admin_password: string

	gridSize: UserConfigGridSize
	gridSizeInlineGrow: boolean
	gridSizePromptGrow: boolean

	installName: string
	default_export_filename: string

	/** Whether to run the mdns  */
	discoveryEnabled: boolean
}

export interface UserConfigGridSize {
	minColumn: number
	maxColumn: number
	minRow: number
	maxRow: number
}
