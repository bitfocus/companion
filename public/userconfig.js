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
