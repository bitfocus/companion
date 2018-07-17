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

	var debug = console.log;

	debug('asking for devices');
	socket.emit('devices_list_get');

	function updateMidiDeviceList(obj) {
		console.log("#### obj", obj);
		var $il = $("#deviceMidiList");
		$il.html("");

		for (var n in obj.inputs) {
			var data = obj.inputs[n];

			var $tr = $("<tr></tr>");

			var $td_id = $("<td></td>");
			var $td_dir = $("<td>Input</td>");
			var $td_state = $("<td></td>");

			$td_id.text(data);
			$td_state.html('<button type="button" data-id="'+data+'" class="midi-input-enable-btn btn btn-success">Connect</button>');

			if (obj.config.inputs !== undefined && obj.config.inputs[data] !== undefined) {
				if (obj.config.inputs[data].connected !== undefined && obj.config.inputs[data].connected === true) {
					$td_state.html('<button type="button" data-id="'+data+'" class="midi-input-disable-btn btn btn-danger">Disconnect</button>');
				}
			}

			$tr.append($td_id);
			$tr.append($td_dir);
			$tr.append($td_state);

			$il.append($tr);
		}

		$('.midi-input-disable-btn').on('click', function() {
			socket.emit('midi_disconnect', 'input', $(this).data('id'));
		});

		$('.midi-input-enable-btn').on('click', function() {
			socket.emit('midi_connect', 'input', $(this).data('id'));
		});

		$('.midi-output-disable-btn').on('click', function() {
			socket.emit('midi_disconnect', 'output', $(this).data('id'));
		});

		$('.midi-output-enable-btn').on('click', function() {
			socket.emit('midi_connect', 'output', $(this).data('id'));
		});

	}

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

	socket.on('midi_devices_list', function(list) {
		updateMidiDeviceList(list);
	});

	socket.on('devices_list', function(list) {
		updateDeviceInstanceList(list);
	});

	$('#refreshUSB').click(function () {
		var $thisbutton = $(this);

		socket.emit('devices_reenumerate');
		socket.emit('midi_reenumerate');

		$thisbutton.data('original-text', $thisbutton.html());
		$thisbutton.html($thisbutton.data('loading-text')).prop('disabled', true);

		socket.once('devices_reenumerate:result', function () {
			$thisbutton.html($thisbutton.data('original-text')).prop('disabled', false);;
		});

	});

});
