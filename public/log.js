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

	var log_types = ['debug','info','warn'];

	var doLogResize = function() {
		$("#log").css('height', ($(window).height() - 150) + 'px')
	};

	$(window).resize(doLogResize);

	function log_config(level, state) {

		var localstore = window.localStorage;
		var g = localstore.getItem("debug_config");

		// Default config
		var config = {
			'debug': false,
			'info': false,
			'warn': true
		};

		if (g !== undefined && g !== null) {
			config = JSON.parse(g);
		}

		if (state === undefined) {
			state = config[level];
		} else {
			config[level] = state;
		}

		localstore.setItem("debug_config", JSON.stringify(config));

		return state;

	}

	socket.on('log', function(time,source,level,message) {

		$('.btn-clear-log').css('opacity', 1);

		var time_format = moment(time).format('DD. HH:mm:ss')
		var state = log_config(level);

		var $line = $("<div class='log-line log-type-"+level+"'>"+time_format+" <strong>"+source+"</strong>: "+message+"</div>")

		if (state || level == 'error') {
			$line.show();
		} else {
			$line.hide();
		}

		$("#log_wrapper").prepend($line);

	});

	socket.on('log_clear', function() {
		$('.btn-clear-log').css('opacity', 0.2);
		$("#log_wrapper").html("");
	});

	$('.btn-clear-log').click(function() {
		$('.btn-clear-log').css('opacity', 0.2);
		socket.emit('log_clear');
		$("#log_wrapper").html("");
	});

	socket.emit('log_catchup');

	for (var dt in log_types) {
		(function(dtype) {

			if (log_config(dtype)) {
				$('.logbuttons .btn-'+dtype).css('opacity', 1);
			} else {
				$('.logbuttons .btn-'+dtype).css('opacity', 0.2);
			}

			$('.logbuttons .btn-'+dtype).click(function() {
				log_config(dtype, !log_config(dtype));
				if (log_config(dtype)) {
					$(this).css('opacity', 1);
					$(".log-type-"+dtype).show();
				} else {
					$(this).css('opacity', 0.2);
					$(".log-type-"+dtype).hide();
				}
				$(this).blur();
			});
		})(log_types[dt]);
	}



	doLogResize();
});
