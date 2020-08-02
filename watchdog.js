module.exports = (settings) => {
    /**
     * for now, this will be in-mem storage,
     * but planning on writing a mongoose
     * method, with calls for updating user,
     * and pulling user.
     * 
     * This will live in @function update_user
     * so for now, the very simple users[ip] = user
     * lives there
     * 
     * ~notU
     */
    let users = {};
	function update_user(ip, user) {
		users[ip] = user;
	};
	return {
		api_limiter: (req) => {
			var timeout, u;
			let time = Date.now();
			let rate = settings.rate;
			// sorted into an ip-userObj matrix
            let ip = req.headers['x-forwardedfor'] || req.connection.remoteAddress;
            /**
             * I hate these if/else statements,
             * but I'll create a more elegent solution when
             * the formula and intended implementation are complete.
             * as it stands,
             * this is a pre-alpha build,
             * so it's not really gonna be used heavily
             * ~notU
             */
            if (!users[ip]) {
                u = {last: time-rate.timeBetween, count:0};
                update_user(ip, u)
			} else {u = users[ip]}
			
			if (u.last+rate.timeBetween > time) { // req-buffer
				console.log("req-buffer rate-limit reached")
				timeout = (u.last+rate.timeBetween)-time;
            } else {timeout = 0}
            // ew ew ew ew ~notU
			u.count += 1;
			u.last = time;
			update_user(ip, u);
			console.log("To Be Executed In (ms): "+timeout)
			return new Promise((resolve, reject) => { 
				setTimeout(() => {
					try {
						resolve(); // executed queued request
					} catch (e) {reject(e)}
				}, timeout)
			})
		},
		collect: (req) => {
			return new Promise((resolve, reject) => {
				let buffer = "";
				req.on('data', (chunk) => {buffer+=chunk})
				req.on('error', (err) => reject(err))
				req.on('end', () => {resolve(JSON.parse(buffer))})
			})
		},
		set_target: (req) => {
			return new Promise((resolve) => {
				let data = req.url.split("/");
				switch (req.url) {
					case "/": // intial website load
						page = "index", asset = "index.html"
						break
					case "/favicon.ico": // fuck you google
						page = "global", asset = "favicon.ico"
						break
					case req.url.match(/[\s\S]*\/\w+/)[0]: // inital page load ex (/account)
						page = data[1], asset = "index.html"
						break
					default: // already set in req.url
						page = data[1], asset = data[2]
				}
				resolve({page: page, asset: asset})
			})
		}
	}
}