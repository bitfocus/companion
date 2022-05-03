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

	document.getElementById('ift').checked = config.start_minimised
	document.getElementById('ifp').value = config.http_port
})
api.send('info')

document.getElementById('ifpb').addEventListener('click', function () {
	var e = document.getElementById('ifp')
	api.send('launcher-set-http-port', e.value)
})

document.getElementById('ift').addEventListener('click', function () {
	var e = document.getElementById('ift')
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

api.send('launcher-ready')
