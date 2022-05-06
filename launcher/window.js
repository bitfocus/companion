document.getElementById('launch').addEventListener('click', function () {
	api.send('launcher-open-gui')
})

document.getElementById('hide').addEventListener('click', function () {
	api.send('launcher-minimize')
})

document.getElementById('close').addEventListener('click', function () {
	api.send('launcher-close')
})

api.receive('info', function (config, info) {
	document.getElementById('status').innerHTML = info.appStatus
	document.getElementById('url').innerHTML = info.appURL
	document.getElementById('model').innerHTML = `Companion v${info.appVersion} (${info.appBuild})`

	document.getElementById('start_minimized').checked = config.start_minimised
	document.getElementById('http_port').value = config.http_port
})
api.send('info')

document.getElementById('http_port_button').addEventListener('click', function () {
	var e = document.getElementById('http_port')
	api.send('launcher-set-http-port', e.value)
})

document.getElementById('start_minimized').addEventListener('click', function () {
	var e = document.getElementById('start_minimized')
	api.send('launcher-set-start-minimised', e.checked)
})

api.receive('network-interfaces:get', function (interfaces) {
	const elm = document.getElementById('ifs')
	elm.innerHTML = "<option value='' selected>Change network interface</option>"

	for (const obj of interfaces) {
		elm.innerHTML += `<option value='${obj.id}'>${obj.label}</option>`
	}
})

document.getElementById('ifs').addEventListener('change', function () {
	var e = document.getElementById('ifs')
	var value = e.options[e.selectedIndex].value
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
