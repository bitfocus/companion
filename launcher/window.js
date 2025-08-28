document.getElementById('launch').addEventListener('click', () => api.send('launcher-open-gui'))
document.getElementById('hide').addEventListener('click', () => api.send('launcher-minimize'))
document.getElementById('close').addEventListener('click', () => api.send('launcher-close'))
document.getElementById('advanced_settings_btn').addEventListener('click', () => api.send('launcher-advanced-settings'))

api.receive('info', (config, info, platform, show_warning) => {
	if (platform !== 'win32' && platform !== 'darwin') {
		document.getElementById('run_at_login_group')?.remove()
	}

	document.getElementById('macos_warning').style.display = show_warning === 'macos' ? 'block' : 'none'

	document.getElementById('status').innerHTML = info.appStatus
	document.getElementById('url').innerHTML = info.appURL
	document.getElementById('model').innerHTML = `Companion v${info.appVersion}`

	document.getElementById('start_minimized').checked = config.start_minimised
	if (document.getElementById('run_at_login')) document.getElementById('run_at_login').checked = config.run_at_login
	document.getElementById('http_port').value = config.http_port
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
