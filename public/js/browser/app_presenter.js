// Veda application Presenter

Veda(function VedaPresenter(veda) { "use strict";

	// Router function
	riot.route( function (hash) {
		var hash_tokens = hash.slice(2).split("/");
		var page = hash_tokens[0];
		var params = hash_tokens.slice(1);
		
		if (!veda.ticket || !veda.user_uri || !veda.end_time) veda.trigger("auth:quit");
		else page != "" ? veda.load(page, params) : $("#main").html( $("#wellcome-template").html() );
	});

	// Listen to a link click and call router
	$("body").on("click", "[href^='#/']", function(e) {
		e.preventDefault();
		var link = $(this);
		return riot.route($(this).attr("href"));
	});

	// Toggle tracing
	$("#set-trace").on("click", function(e) {
		var $el = $(this);
		e.preventDefault();
		if ($el.hasClass("active")) { 
			set_trace(0, false);
			$el.removeClass("active");
			return;
		}
		set_trace(0, true);
		$el.addClass("active");
	});

	// Listen to logout click
	$("#logout").on("click", function(e) {
		e.preventDefault();
		$("#current-user").html("");
		veda.trigger("auth:quit");
	});

	// Listen to quit && authentication failure events
	veda.on("auth:quit auth:failed", function () {
		deleteCookie("user_uri");
		deleteCookie("ticket");
		deleteCookie("end_time");
		
		//Show login form
		var template = $("#login-template").html();
		$("#main").html(template);		

		$("#login-form #submit").on("click", function(event) {
			event.preventDefault();
			veda.authenticate( $("#login-form #login").val(), Sha256.hash( $("#login-form #password").val() ) );
		});
	});

	// Listen to user loaded event
	veda.on("app:complete", function (user_uri, ticket, end_time) {
		setCookie("user_uri", user_uri, { path: "/", expires: new Date(parseInt(end_time)) });
		setCookie("ticket", ticket, { path: "/", expires: new Date(parseInt(end_time)) });
		setCookie("end_time", end_time, { path: "/", expires: new Date(parseInt(end_time)) });
		riot.route(location.hash, true);
	});

	// If ticket absent or expired show login form
	if (!getCookie("ticket") || !getCookie("user_uri") || !getCookie("end_time")) return veda.trigger("auth:quit");
	veda.ticket = getCookie("ticket");
	veda.user_uri = getCookie("user_uri");
	veda.end_time = getCookie("end_time");
	veda.trigger("auth:success", veda.user_uri, veda.ticket, veda.end_time);

});