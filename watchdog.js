const fs = require('fs');

module.exports = (settings) => {
	let users = JSON.parse(fs.readFileSync("./users.json"));
	function update_user(ip, user) {
		users[ip] = user;
		fs.writeFile("./users.json", JSON.stringify(users, null, 2), (err) => {
			if (err) {console.log("[!] "+err)}
		})
	};
	function jailbreak() {
		fs.writeFile("./users.json", JSON.stringify({}, null, 2), (err) => {
			if (err) {console.log("[!] "+err)}
		})
	}
	jailbreak(); // wipe all records on server start
	return {
		api_limiter: (req) => {
			var timeout;
			let time = Date.now();
			let rate = settings.rate;
			// sorted into an ip-userObj matrix
			let ip = req.headers['x-forwardedfor'] || req.connection.remoteAddress;
			let u = users[ip];
			// new user
			if (!u) {u = {last: time-rate.timeBetween, count:0}; update_user(ip, u)}
			if (u.last+rate.timeBetween > time) { // req-buffer
				console.log("req-buffer rate-limit reached")
				timeout = (u.last+rate.timeBetween)-time;
			} else {timeout = 0}
			u.count += 1;
			u.last = time;
			update_user(ip, u);
			console.log("Timeout Value (ms): "+timeout)
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