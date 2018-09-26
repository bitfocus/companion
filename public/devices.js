/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

$(function() {
	var iconfig = {};
	var device_list = {};

	var debug = console.log;

	debug('asking for devices');
	socket.emit('devices_list_get');

	$('#deviceInstanceList').on('click', '.device_settings', function () {
		var id = $(this).parents('tr').prop('id');
		var device = device_list[id];
		socket.emit('device_config_get', device.id);
		socket.once('device_config_get:result', function (err, settings) {
			console.log("device_config_get:", err,settings);

			$('#deviceModal .modal-body').html('');

			if (device.config.indexOf('brightness') !== -1) {
				var $form = $('<form><div class="form-group"><label for="brightness" class="col-form-label">Brightness:</label><input type="range" class="form-control-range brightness"></div></form>');
				var $slider = $form.find('input');
				$slider.val(settings.brightness);
				$slider.on('input', function () {
					settings.brightness = parseInt($slider.val());
					socket.emit('device_config_set', device.id, settings);
					console.log("Value: ", $slider.val());
				})
				$('#deviceModal .modal-body').append($form);
			}

			if (device.config.indexOf('orientation') !== -1) {
				var $form = $('<form><div class="form-group"><label for="rotation" class="col-form-label">Rotation:</label><select class="form-control"><option value="0">Normal</option><option value="90">90 CCW</option></select></div></form>');
				var $select = $form.find('select');
				$select.val(settings.rotation);
				$select.on('change', function () {
					settings.rotation = parseInt($select.val());
					socket.emit('device_config_set', device.id, settings);
					console.log("Value: ", $select.val());
				})
				$('#deviceModal .modal-body').append($form);
			}


			$('#deviceModal').modal();

		});
	});

	function updateDeviceInstanceList(list, dontclear) {
		device_list = list;
		debug('got devices', list);

		var $il = $("#deviceInstanceList");
		if (!dontclear) $il.html("");

		for (var n in list) {
			var data = list[n];

			var $tr = $("<tr></tr>");

			var $td_id = $("<td></td>");
			var $td_type = $("<td></td>");
			var $td_settings = $("<td class='text-center'></td>");

			$td_id.text(data.serialnumber);
			$td_type.text(data.type);

			if (data.config !== undefined && data.config.length > 0) {
				$td_settings.html("<button class='device_settings align-center btn btn-success'><i class='fa fa-gear'></i> Settings</button>");
			}

			$tr.prop('id', n);
			$tr.append($td_id);
			$tr.append($td_type);
			$tr.append($td_settings);

			$il.append($tr);
		}
	};

	socket.on('devices_list', function(list) {

		updateDeviceInstanceList(list);

	});

	$('#refreshUSB').click(function () {
		var $thisbutton = $(this);

		socket.emit('devices_reenumerate');

		$thisbutton.data('original-text', $thisbutton.html());
		$thisbutton.html($thisbutton.data('loading-text')).prop('disabled', true);

		socket.once('devices_reenumerate:result', function () {
			$thisbutton.html($thisbutton.data('original-text')).prop('disabled', false);;
		});

	});

});
