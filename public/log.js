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


	var doLogResize = function() {
		console.log("resizing");
		$("#log").css('height', ($(window).height() - 240) + 'px')
	};

	$(window).resize(doLogResize);

	socket.on('log', function(time,source,level,message) {
		var time_format = moment(time).format('DD. HH:mm:ss')
		var $line = $("<div class='log-line log-type-"+level+"'>"+time_format+" <strong>"+source+"</strong>: "+message+"</div>")
		$("#log").prepend($line);

	});

	socket.emit('log_catchup');

	doLogResize();
});
