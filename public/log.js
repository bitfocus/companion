$(function() {


	var doLogResize = function() {
		console.log("resizing");
		$("#log").css('height', ($(window).height() - 240) + 'px')
	};

	$(window).resize(doLogResize);

	socket.on('log', function(time,source,level,message) {
		var time_format = moment(time).format('MMMM Do YYYY, HH:mm:ss')
		var $line = $("<div class='log-line log-type-"+level+"'>"+time_format+" <strong>"+source+"</strong>: "+message+"</div>")
		$("#log").prepend($line);

	});

	socket.emit('log_catchup');

	doLogResize();
});
