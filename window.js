document.getElementById('launch').addEventListener('click', function () {
	api.send('skeleton-launch-gui')
})

document.getElementById('hide').addEventListener('click', function () {
	api.send('skeleton-minimize')
})

document.getElementById('close').addEventListener('click', function () {
	api.send('skeleton-close')
})

api.receive('info', function (info) {
	document.getElementById('status').innerHTML = info.appStatus
	document.getElementById('url').innerHTML = info.appURL
	document.getElementById('model').innerHTML = `${info.appName} v${info.appVersion} (${info.appBuild})`
	document.getElementById('ift').checked = info.startMinimised
	document.title = info.appName
})
api.send('info')

document.getElementById('ifpb').addEventListener('click', function () {
	var e = document.getElementById('ifp')
	api.send('skeleton-bind-port', e.value)
})

document.getElementById('ift').addEventListener('click', function () {
	var e = document.getElementById('ift')
	api.send('skeleton-start-minimised', e.checked)
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
	api.send('skeleton-bind-ip', value)
})

api.send('network-interfaces:get')

api.send('skeleton-ready')
