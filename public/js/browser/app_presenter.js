// Veda application Presenter

veda.Module(function AppPresenter(veda) { "use strict";

	// Listen to logout click
	$("#logout").on("click", function (e) {
		$("#current-user").html("");
		delCookie("user_uri"); delCookie("ticket"); delCookie("end_time");
		veda.logout();
	});
	
	// Prevent empty links routing
	$("body").on("click", "[href='']", function (e) {
		e.preventDefault();
	});

	// Toggle tracing
	$("#set-trace").on("click", function (e) {
		var $el = $(this).parent();
		if ($el.hasClass("active")) { 
			set_trace(0, false);
			$el.removeClass("active");
			return;
		}
		set_trace(0, true);
		$el.addClass("active");
	});

	// Clear local storage
	$("#clear-storage").on("click", function (e) {
		localStorage.clear();
		location.reload();
	});
	
	// Toggle language
	veda.on("language:changed", function () {
		//veda.init();
		//riot.route(location.hash, true);
		location.reload();
	});
	
	// Triggered in veda.init()
	veda.one("started", function () {
		// Router function
		riot.route( function (hash) {
			var hash_tokens = hash.slice(2).split("/");
			var page = hash_tokens[0];
			var params = hash_tokens.slice(1);
			if (page !== "") {
				$("#menu li").removeClass("active");
				$("#menu li#" + veda.Util.escape4$(page)).addClass("active");
				veda.load(page, params);
			} else {
				$("#menu li").removeClass("active");
				veda.user.aspect.present("#main");
			}
		});
	});	

	veda.on("started", function () {		
		// Forced route to current hash
		riot.route(location.hash, true);
	});

	// Route on link click
	$("body").on("click", "[href^='#/']", function (e) {
		e.preventDefault();
		var forced, 
			hash = $(this).attr("href");
		forced = (hash === location.hash ? false : true);
		return riot.route(hash, forced);
	});
	
	// Login invitation
	veda.on("login:failed", function () {
		var template = $("#login-template").html();
		var container = $("#login");
		container.removeClass("hidden");
		container.html(template);
		$("#submit", container).on("click", function (e) {
			e.preventDefault();
			// Successful authentication calls veda.init() in model
			var authResult = veda.login( $("#login", container).val(), Sha256.hash( $("#password", container).val() ) );
			if (!authResult) return veda.trigger("login:failed");
			setCookie("user_uri", authResult.user_uri, { path: "/", expires: new Date(parseInt(authResult.user_uri)) });
			setCookie("ticket", authResult.ticket, { path: "/", expires: new Date(parseInt(authResult.user_uri)) });
			setCookie("end_time", authResult.end_time, { path: "/", expires: new Date(parseInt(authResult.user_uri)) });
			container.addClass("hidden");
		});
	});

	// Initialize application if ticket is valid
	veda.on("login:success", function (authResult) {
		veda.user_uri = authResult.user_uri;
		veda.ticket = authResult.ticket;
		veda.end_time = authResult.end_time;
		veda.init();
	});

	// Check if ticket in cookies is valid
	var ticket = getCookie("ticket") == "undefined" ? undefined : getCookie("ticket"), 
		user_uri = getCookie("user_uri") == "undefined" ? undefined : getCookie("user_uri"),  
		end_time = getCookie("end_time") == "undefined" ? undefined : getCookie("end_time");
	
	if ( ticket && user_uri && end_time && is_ticket_valid(ticket) ) { 
		veda.trigger("login:success", {
			user_uri: user_uri,
			ticket: ticket, 
			end_time: end_time
		});
	} else { 
		veda.trigger("login:failed");
	}
	
});
