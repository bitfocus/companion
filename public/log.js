$(function() {


	var doLogResize = function() {
		console.log("resizing");
		$("#log").css('height', ($(window).height() - 240) + 'px')
	};

	$(window).resize(doLogResize);

	socket.on('log', function(time,source,level,message) {

		var $line = $("<p><strong>"+source+" "+level+" "+time+"</strong><br>"+message+"</p>")
		$("#log").prepend($line);

	});

	socket.emit('log_catchup');

	doLogResize();
});
