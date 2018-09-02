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

var been_connected = false;

var picker_colors = [
	"#000000",
	"#FFFFFF",
	"#003366",
	"#336699",
	"#3366CC",
	"#003399",
	"#000099",
	"#0000CC",
	"#000066",
	"#006666",
	"#006699",
	"#0099CC",
	"#0066CC",
	"#0033CC",
	"#0000FF",
	"#3333FF",
	"#333399",
	"#669999",
	"#009999",
	"#33CCCC",
	"#00CCFF",
	"#0099FF",
	"#0066FF",
	"#3366FF",
	"#3333CC",
	"#666699",
	"#339966",
	"#00CC99",
	"#00FFCC",
	"#00FFFF",
	"#33CCFF",
	"#3399FF",
	"#6699FF",
	"#6666FF",
	"#6600FF",
	"#6600CC",
	"#339933",
	"#00CC66",
	"#00FF99",
	"#66FFCC",
	"#66FFFF",
	"#66CCFF",
	"#99CCFF",
	"#9999FF",
	"#9966FF",
	"#9933FF",
	"#9900FF",
	"#006600",
	"#00CC00",
	"#00FF00",
	"#66FF99",
	"#99FFCC",
	"#CCFFFF",
	"#CCCCFF",
	"#CC99FF",
	"#CC66FF",
	"#CC33FF",
	"#CC00FF",
	"#9900CC",
	"#003300",
	"#009933",
	"#33CC33",
	"#66FF66",
	"#99FF99",
	"#CCFFCC",
	"#FFCCFF",
	"#FF99FF",
	"#FF66FF",
	"#FF00FF",
	"#CC00CC",
	"#660066",
	"#336600",
	"#009900",
	"#66FF33",
	"#99FF66",
	"#CCFF99",
	"#FFFFCC",
	"#FFCCCC",
	"#FF99CC",
	"#FF66CC",
	"#FF33CC",
	"#CC0099",
	"#993399",
	"#333300",
	"#669900",
	"#99FF33",
	"#CCFF66",
	"#FFFF99",
	"#FFCC99",
	"#FF9999",
	"#FF6699",
	"#FF3399",
	"#CC3399",
	"#990099",
	"#666633",
	"#99CC00",
	"#CCFF33",
	"#FFFF66",
	"#FFCC66",
	"#FF9966",
	"#FF6666",
	"#FF0066",
	"#CC6699",
	"#993366",
	"#999966",
	"#CCCC00",
	"#FFFF00",
	"#FFCC00",
	"#FF9933",
	"#FF6600",
	"#FF5050",
	"#CC0066",
	"#660033",
	"#996633",
	"#CC9900",
	"#FF9900",
	"#CC6600",
	"#FF3300",
	"#FF0000",
	"#CC0000",
	"#990033",
	"#663300",
	"#996600",
	"#CC3300",
	"#993300",
	"#990000",
	"#800000",
	"#993333"
];

socket.on('connect', function() {
	if (been_connected === true) {
		window.location.reload(true);
	}
	been_connected = true;
});

$(function() {

	socket.on('skeleton-info', function(hash) {
		console.log("skeleton-info", hash);
		$("#versiontext").text(hash.appVersion);
	});


	socket.on('disconnect', function() {
		$("#error-container").fadeIn();
	})

});

$.fn.isInViewport = function() {
	var elementTop = $(this).offset().top;
	var elementBottom = elementTop + $(this).outerHeight();
	var viewportTop = $(window).scrollTop();
	var viewportBottom = viewportTop + $(window).height();
	return elementBottom > viewportTop && elementTop < viewportBottom;
};
