document.getElementById('launch').addEventListener('click', () => api.send('launcher-open-gui'))
document.getElementById('hide').addEventListener('click', () => api.send('launcher-minimize'))
document.getElementById('close').addEventListener('click', () => api.send('launcher-close'))
document.getElementById('developer_settings').addEventListener('click', () => api.send('toggle-developer-settings'))
document
	.getElementById('dev_modules_path_pick')
	.addEventListener('click', () => api.send('pick-developer-modules-path'))
document
	.getElementById('dev_modules_path_clear')
	.addEventListener('click', () => api.send('clear-developer-modules-path'))

document.getElementById('enable_syslog').addEventListener('click', () => {
	const elm = document.getElementById('enable_syslog')
	api.send('launcher-enable-syslog', elm.checked)
})

document.getElementById('syslog_tcp').addEventListener('click', () => {
	const elm = document.getElementById('syslog_tcp')
	api.send('launcher-enable-syslog-tcp', elm.checked)
})

document.getElementById('syslog_host_button').addEventListener('click', () => {
	const elm = document.getElementById('syslog_host')
	api.send('launcher-set-syslog-host', elm.value)
})

document.getElementById('syslog_port_button').addEventListener('click', () => {
	const elm = document.getElementById('syslog_port')
	api.send('launcher-set-syslog-port', elm.value)
})

document.getElementById('syslog_localhost_button').addEventListener('click', () => {
	const elm = document.getElementById('syslog_localhost')
	api.send('launcher-set-syslog-localhost', elm.value)
})

api.receive('info', (config, info, platform) => {
	if (platform !== 'win32' && platform !== 'darwin') {
		document.getElementById('run_at_login_group')?.remove()
	}

	document.getElementById('status').innerHTML = info.appStatus
	document.getElementById('url').innerHTML = info.appURL
	document.getElementById('model').innerHTML = `Companion v${info.appVersion}`

	document.getElementById('start_minimized').checked = config.start_minimised
	if (document.getElementById('run_at_login')) document.getElementById('run_at_login').checked = config.run_at_login
	document.getElementById('http_port').value = config.http_port

	document.getElementById('developer_settings_panel').style.display = config.enable_developer ? 'block' : 'none'
	document.getElementById('dev_modules_path').value = config.dev_modules_path || ''
	document.getElementById('enable_syslog').checked = config.enable_syslog || false
	document.getElementById('syslog_tcp').checked = config.syslog_tcp || false
	document.getElementById('syslog_host').value = config.syslog_host || '127.0.0.1'
	document.getElementById('syslog_port').value = config.syslog_port || '514'
	document.getElementById('syslog_localhost').value = config.syslog_localhost || `Companion`
})
api.send('info')

document.getElementById('http_port_button').addEventListener('click', () => {
	const elm = document.getElementById('http_port')
	api.send('launcher-set-http-port', elm.value)
})

document.getElementById('start_minimized').addEventListener('click', () => {
	const elm = document.getElementById('start_minimized')
	api.send('launcher-set-start-minimised', elm.checked)
})

document.getElementById('run_at_login').addEventListener('click', () => {
	const elm = document.getElementById('run_at_login')
	api.send('launcher-set-run-at-login', elm.checked)
})

api.receive('network-interfaces:get', (interfaces) => {
	const elm = document.getElementById('ifs')
	elm.innerHTML = "<option value='' selected>Change network interface</option>"

	for (const obj of interfaces) {
		elm.innerHTML += `<option value='${obj.id}'>${obj.label}</option>`
	}
})

document.getElementById('ifs').addEventListener('change', () => {
	const elm = document.getElementById('ifs')
	const value = elm.options[elm.selectedIndex].value
	api.send('launcher-set-bind-ip', value)
})

api.send('network-interfaces:get')

function handleResize() {
	api.send('setHeight', document.querySelector('#wrap').offsetHeight)
}

// Listen to the window contents resizing, and update the window to match
const resizeObserver = new ResizeObserver(() => handleResize())
resizeObserver.observe(document.querySelector('#wrap'))
handleResize()
