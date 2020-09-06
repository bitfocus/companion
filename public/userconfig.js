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

var userconfig = {};

$(function() {


	var userConfigUpdate = function() {

		// set the page direction flipped option
		var state = userconfig.page_direction_flipped;
		var $cb = $('#userconfig_page_direction_flipped');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		// set the external keymapping option
		var state = userconfig.emulator_control_enable;
		var $cb = $('#userconfig_emulator_control_enable');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		// enable pincode lockouts
		var state = userconfig.pin_enable;
		var $cb = $('#userconfig_pin_enable');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		// link the surfaces lockout state together
		var state = userconfig.link_lockouts;
		var $cb = $('#userconfig_link_lockouts');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		// set the page plus/minus option
		var state = userconfig.page_plusminus;
		var $cb = $('#userconfig_page_plusminus');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		// set the artnet enabled option
		var state = userconfig.artnet_enabled;
		var $cb = $('#userconfig_artnet_enabled');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

		var state = userconfig.artnet_universe;
		var $cb = $('#userconfig_artnet_universe');
		$cb.val(state);

		var state = userconfig.pin;
		var $cb = $('#userconfig_pin');
		$cb.val(state);

		var state = userconfig.pin_timeout;
		var $cb = $('#userconfig_pin_timeout');
		$cb.val(state);

		var state = userconfig.artnet_channel;
		var $cb = $('#userconfig_artnet_channel');
		$cb.val(state);

		// set the artnet enabled option
		var state = userconfig.rosstalk_enabled;
		var $cb = $('#userconfig_rosstalk_enabled');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

	};



	// when userconfig is changed from the userconfig tab
	$('#userconfig_page_direction_flipped').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'page_direction_flipped', true);
		} else {
			socket.emit('set_userconfig_key', 'page_direction_flipped', false);
		}
	});

	// when emulator_control_enable is changed from the userConfig tab
	$('#userconfig_emulator_control_enable').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'emulator_control_enable', true);
			window.open('emulator.html');
		} else {
			socket.emit('set_userconfig_key', 'emulator_control_enable', false);
			window.open('emulator.html');
		}
	});

	$('#userconfig_pin_enable').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'pin_enable', true);
		} else {
			socket.emit('set_userconfig_key', 'pin_enable', false);
		}
	});

	$('#userconfig_link_lockouts').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'link_lockouts', true);
		} else {
			socket.emit('set_userconfig_key', 'link_lockouts', false);
		}
	});

	$('#userconfig_page_plusminus').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'page_plusminus', true);
		} else {
			socket.emit('set_userconfig_key', 'page_plusminus', false);
		}
	});


	$('#userconfig_artnet_enabled').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'artnet_enabled', true);
		} else {
			socket.emit('set_userconfig_key', 'artnet_enabled', false);
		}
	});

	$('#userconfig_rosstalk_enabled').click(function() {
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'rosstalk_enabled', true);
		} else {
			socket.emit('set_userconfig_key', 'rosstalk_enabled', false);
		}
	});

	$('#userconfig_artnet_universe').keyup(function() {
		socket.emit('set_userconfig_key', 'artnet_universe', $('#userconfig_artnet_universe').val());
	});

	$('#userconfig_pin').keyup(function() {
		socket.emit('set_userconfig_key', 'pin', $('#userconfig_pin').val());
	});

	$('#userconfig_pin_timeout').keyup(function() {
		socket.emit('set_userconfig_key', 'pin_timeout', $('#userconfig_pin_timeout').val());
	});

	$('#userconfig_artnet_channel').keyup(function() {
		socket.emit('set_userconfig_key', 'artnet_channel', $('#userconfig_artnet_channel').val());
	});






	// when server updates the entire config array
	socket.on('get_userconfig_all', function(config) {
		userconfig = config;
		userConfigUpdate();
	});

	// when other browsers update userconfig
	socket.on('set_userconfig_key', function(key, value) {
		userconfig[key]=value;
		userConfigUpdate();
	});

	// ask for the entire config
	socket.emit('get_userconfig_all');


});
