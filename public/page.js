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

var page_info = {};

$(function() {

	var pageUpdate = function() {
		var $cb = $('#page_title');
		$cb.val(page_info[page].name);
	};

	// when page name is changed from the input field
	$('#elgatobuttons').on('keyup', "#page_title", function() {
		var str = $('#page_title').val().substr(0,11);
		page_info[page].name = str !== "" ? str : "PAGE";
		socket.emit('set_page', page, page_info[page]);
	});

	// when server updates the entire page array
	socket.on('get_page_all', function(config) {
		page_info = config;
		pageUpdate();
	});

	// when other browsers update page
	socket.on('set_page', function(key, value) {
		page_info[key]=value;
		pageUpdate();
	});

	// ask for the entire config
	socket.emit('get_page_all');


});
