$(function() {
	var iconfig = {};

	var debug = console.log;

	debug('asking for devices');
	socket.emit('devices_list_get');

	function updateDeviceInstanceList(list, dontclear) {
		debug('got devices');

		var $il = $("#deviceInstanceList");
		if (!dontclear) $il.html("");

		for (var n in list) {
			var data = list[n];

			var $tr = $("<tr></tr>");

			var $td_id = $("<td></td>");
			var $td_type = $("<td></td>");

			$td_id.text(data.serialnumber);
			$td_type.text(data.type);

			$tr.append($td_id);
			$tr.append($td_type);

			$il.append($tr);
		}
	};

	socket.on('devices_list', function(list) {

		updateDeviceInstanceList(list);

	});

	$('#refreshUSB').click(function () {
		var thisbutton = this;

		socket.emit('devices_reenumerate');
		$(thisbutton).button('loading');

		socket.once('devices_reenumerate:result', function () {
			$(thisbutton).button('reset');
		});

	});

});
