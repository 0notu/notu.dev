process.on('uncaughtException', (e) => {console.log(e)})

const http = require('http');
const fs = require('fs');
const Worker = require('./worker.js');
const { uuid } = require('uuidv4');


module.exports = class webServer {
  constructor (pages, secret, types) {
    this.pages = pages
    this.secret = secret
    this.types = types

    this.workers = []

    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.listen(this.secret.port || 80) // in production this should be 80
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
        console.log("[#] Path File Updated")
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

  _collect(req, call) { // ease of use
    let buffer = [];
    req.on('data', (chunk) => {
      buffer.push(chunk);
    });
    req.on('end', () => {call(JSON.parse(buffer))})
  }

  _employment(res, data) { // worker management
    let worker;
    let time = Date.now();
    if (!data.token) {data.token = uuid()}
    try {
      if (this.workers.find(u => u.user == data.token)) {
        worker = this.workers.find(u => u.user == data.token)
      } else {throw "e"}
    } catch {
      console.log("before")
      worker = new Worker(this.secret.url, data.token, time += this.secret.api);
      console.log("after")
      console.log("worker: "+worker)
      this.workers.push(worker);
    } finally {
      console.log(data)
      worker.work(res, data);
      return worker;
    }
  }

  handle(req, res) {
    let page, asset;
    let data = req.url.split("/");
    if (data[1] == "api") { // proxying api requests through webserver
      this._collect(req, (content) => {
        console.log(content)
        let worker = this._employment(res, content);
        worker.on('invalidToken', () => { // on token timeout
          conent.token, worker = null; // prune old worker & reset token
          this._employment(res, conent) // new worker + token
        })
      });
    } else {
      // NOTE this is ugly, fix it
      let outcomes = [
        {position: 1, check: "", page: "index", asset: "index.html"}, // intial index load
        {position: 1, check: "favicon.ico", page: "global", asset: "favicon.ico"}, // initial favicon request
        {position: 0, check: "", page: data[1], asset: "index.html"} // intial page(group) load
      ]
      try {
        if (data[2]) {throw error} // group & asset already set
        let correct = outcomes.find(o => data[o.position] == o.check);
        page = correct.page, asset = correct.asset
      } catch { // page and asset already set
        page = data[1], asset = data[2]
      }
      // end NOTE
      try { // content exists
        this.pages[page].find(a => a.alias == asset)
        this.serveAsset(req, res, {page: page, asset: asset})
      } catch { // page does not exist
        this.serveAsset(req, res, {page: "404", asset: "index.html"})
      }
    }
  }
}