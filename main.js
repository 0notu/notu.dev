process.on('uncaughtException', (e) => {console.log(e)})

const http = require('http');
const fs = require('fs');

const api = require('./api.js');
const watchdog = require('./watchdog.js')


module.exports = class webServer {
  constructor (pages, secret, types) {
    this.pages = pages
    this.secret = secret
    this.types = types

    this.watchdog = watchdog(this.secret.watchdog)

    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.listen(/*this.secret.port ||*/80) // in production this should be 80
  }

  async init() {
    this.initPages();
  }

  // tools for modifying/adding/removing assets+pages
  // reads and returns file paths
  dig(dir, callback) {
    var ret = [];
    fs.readdir(dir, {withFileTypes: true}, (err, content) => {
      if (err) return callback(err,[]);
      var pending = content.length;
      if (!pending) return callback(null, ret); // done, reached the end of this branch
      content.forEach((file) => {
        var path = (dir+"/"+file.name);
        if (file.isDirectory()) {
          this.dig(path, (err, res) => {
            ret = ret.concat(res);
            if (!--pending) callback(null, ret)
          })
        } else {
          ret.push(path);
          if (!--pending) callback(null, ret)
        }
      })
    })
  }
  // formatting
  initPages() { // auto updates "pages" json on server run
    this.dig("./pages", (err, data) => {
      if (err) {console.log(err)}
      this.pages = {}; // wipe the whole thing
      for (var path of data) {
        let detail = {
          location: path,
          alias: path.split("/").pop(),
          ext: path.split("/").pop().split(".").pop()
        }
        let group = path.split("/")[2];
        if (this.pages[group] === undefined) { // new group
          this.pages[group] = [];
        }
        this.pages[group].push(detail)
      }
      fs.writeFile("./pages.json", JSON.stringify(this.pages, null, 2), (err) => {
        if (err) {console.log("[!] "+err)}
      })
    })
  }

  serveImage(req, res, file) {
    var c = fs.createReadStream(file.location);
    c.on('open', () => {
      res.setHeader('Content-Type', this.types[file.ext]);
      c.pipe(res)
    })
  }

  serveAsset(req, res, data) {
    let f = this.pages[data.page].find(a => a.alias == data.asset);
    if (this.types[f.ext].split("/")[0] == "image") {
      this.serveImage(req, res, f)
    } else {
      fs.readFile(f.location, 'utf-8', (err, data) => {
        if (err) {
          serveAsset(req, res, {page: "500", asset: "index.html"}) // recursion to the rescue
        } else { // all's good
          res.writeHead(200, {'Content-Type': this.types[f.ext] || "application/octet-stream"});
          res.end(data, 'utf-8')
        }
      });
    }
  }

  handle(req, res) {
    let data = req.url.split("/");
    if (data[1] == "api") { // proxying api requests through webserver
      this.watchdog.collect(req).then(content => {
        this.watchdog.api_limiter(req).then(() => {
          res.end(JSON.stringify(api[content.method](content)))
        }, err => {
          console.log(err);
          res.setHeader(500);
          res.end(JSON.stringify(err))
        });
      });
    } else {
      this.watchdog.set_target(req).then((obj) => {
        let page = obj.page;
        let asset = obj.asset;
        try { // content exists
          this.pages[page].find(a => a.alias == asset)
          this.serveAsset(req, res, {page: page, asset: asset})
        } catch { // page does not exist
          this.serveAsset(req, res, {page: "404", asset: "index.html"})
        }
      })
    }
  }
}