var Client = require('electron-rpc/client')
var client = new Client();
var network = require('network');

var skeleton_info = {
	appName: 'appName',
	appVersion: 'appVersion',
	appURL: 'appURL',
	appStatus: 'appStatus',
	startMinimised: 'startMinimised',
};

function add_log(line) {
	var old_log = document.getElementById("log").innerHTML;
	document.getElementById("log").innerHTML = old_log + "\n" + line;
	var textarea = document.getElementById('log');
	if (textarea.scrollHeight - textarea.scrollTop - textarea.offsetHeight < 20) {
		textarea.scrollTop = textarea.scrollHeight;
	}
}

function skeleton_info_draw() {
	document.getElementById("status").innerHTML = skeleton_info.appStatus;
	document.getElementById("url").innerHTML    = skeleton_info.appURL;
	document.getElementById("model").innerHTML  = skeleton_info.appName + " v" + skeleton_info.appVersion + " (" + skeleton_info.appBuild.replace(/-*master-*/, "").replace(/^-/, "")  + ")";
	document.getElementById("ift").checked = skeleton_info.startMinimised;
	document.title = skeleton_info.appName;
}

document.getElementById('launch').addEventListener('click', function() {
	client.request('skeleton-launch-gui');
});

document.getElementById('hide').addEventListener('click', function() {
	client.request('skeleton-minimize');
});

document.getElementById('close').addEventListener('click', function() {
	client.request('skeleton-close');
});

client.request('info', function(err, obj) {
	skeleton_info = obj;
	skeleton_info_draw();
});

client.on('alert', function(err, obj) {
	alert("Alert! " + obj);
	console.log("XXXXX", err,obj);
});

client.on('info', function(err, obj) {
	skeleton_info = obj;
	skeleton_info_draw();
});

client.on('log', function(err, line) {
	//add_log(line);
});

document.getElementById('ifpb').addEventListener('click', function() {
	var e = document.getElementById("ifp");
	client.request('skeleton-bind-port', e.value);
});

document.getElementById('ift').addEventListener('click', function() {
	var e = document.getElementById("ift");
	client.request('skeleton-start-minimised', e.checked);
});

function get_interfaces_list() {
	network.get_interfaces_list(function(err, list) {
		document.getElementById("ifs").innerHTML = "<option value='' selected>Change network interface</option><option value='127.0.0.1'>localhost / 127.0.0.1</option>";

		for (var n in list) {
			var obj = list[n];
			var x = document.getElementById("ifs").innerHTML + "";
			if (obj.ip_address !== null) {
				document.getElementById("ifs").innerHTML += "<option value='"+obj.ip_address+"'>"+obj.name+": "+obj.ip_address+" ("+obj.type+")</option>";
			}
		}

		document.getElementById('ifs').addEventListener('change', function() {
			var e = document.getElementById("ifs");
			var value = e.options[e.selectedIndex].value;
			client.request('skeleton-bind-ip', value);
		});

	});

}

get_interfaces_list();

client.request('skeleton-ready');


//alert( JSON.stringify( {dir:  } ));
