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

		// set the page plus/minus option
		var state = userconfig.page_plusminus;
		var $cb = $('#userconfig_page_plusminus');

		if (state === true) {
			$cb.prop('checked', true);
		} else {
			$cb.prop('checked', false);
		}

	};

	// when userconfig is changed from the userconfig tab
	$('#userconfig_page_direction_flipped').click(function() {
		console.log('clicked', $(this).prop('checked') );
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'page_direction_flipped', true);
		} else {
			socket.emit('set_userconfig_key', 'page_direction_flipped', false);
		}
	});

	$('#userconfig_page_plusminus').click(function() {
		console.log('clicked', $(this).prop('checked') );
		if ($(this).prop('checked') == true) {
			socket.emit('set_userconfig_key', 'page_plusminus', true);
		} else {
			socket.emit('set_userconfig_key', 'page_plusminus', false);
		}
	});







	// when server updates the entire config array
	socket.on('get_userconfig_all', function(config) {
		console.log('updating entire userconfig:', config)
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
