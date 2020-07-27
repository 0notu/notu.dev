process.on('error', console.log);

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const Worker = require('./worker.js');
const { worker } = require('cluster');

function requireJSON(path) { // readJSON cacheless
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
};

const paths = requireJSON("./paths.json")
const config = requireJSON("./config.json")

// api workers
var workers = [];

// reads and returns file path
function dig(dir, callback) {
  var ret = [];
  fs.readdir(dir, {withFileTypes: true}, (err, content) => {
    if (err) return callback(err);
    var pending = content.length;
    if (!pending) return callback(null, ret); // done, reached the end of this branch
    content.forEach((file) => {
      path = (dir+"/"+file.name);
      if (file.isDirectory()) {
        dig(path, (err, res) => {
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

function initPages() { // auto updates "pages" json on server run
  dig("../pages", (err, data) => {
    console.log(data); // debugging
    paths.pages = {}; // wipe the whole thing
    for (var path of data) {
      let detail = {
        location: path,
        alias: path.split("/").pop(),
        ext: path.split("/").pop().split(".").pop()
      }
      let group = path.split("/")[2];
      if (paths.pages[group] === undefined) { // new group
        paths.pages[group] = [];
      }
      paths.pages[group].push(detail)
    }
    fs.writeFile("./paths.json", JSON.stringify(paths, null, 2), (err) => {
      console.log("[!] './paths.json' updated")
      if (err) {console.log(err)}
    })
  })
}

function serve_asset(res, data) {
  let f = paths.pages[data.page].find(a => a.alias == data.asset);
  fs.readFile(f.location, 'utf-8', (err, data) => {
    if (err) {
      serve_asset(res, {page: "500", asset: "index.html"}) // recursion to the rescue
    } else { // all's good
      res.writeHead(200, {'Content-Type': paths.types[f.ext] || "application/octet-stream"});
      res.end(data, 'utf-8')
    }
  });
}

function serve_img(file, res) {
  var c = fs.createReadStream(file.location);
  c.on('open', () => {
    res.setHeader('Content-Type', this.paths.types[file.ext]);
    c.pipe(res)
  })
}

function collect_api(req, res) { // api requests
  let reqStream = "";
  req.on('data', (chunkData) => { // wait for whole request
    reqStream += chunkData
  });
  req.on('end', () => { // data ready to be used
    let data = JSON.parse(reqStream);
    // token should not be used for any "secure" operations
    if (!data.token || !data.token_timestamp) {
      data.token = uuidv4();
      data.token_timestamp = new Date()+=30000;
    }
    try {
      let worker = workers.find(u => u.token == data.token)
    } catch {
      worker = new Worker(data.token, config.url);
      workers.push(worker)
    } finally {
      worker.handle(data, res)
    }
    /*
    var token = data.token
    let userWorker = workers.find(w => w.user == token);
    if (userWorker === undefined) { // no worker exists, so make a new one
      userWorker = new Worker(token, config.url); // TODO:
      workers.push(userWorker);
    }
    userWorker.handle(req, res, data)
  */
  })
}


function handle(req, res) {
  if (req.url == "/api") {
    collect_api(req, res) // api request
  } else {
    let page, asset;
    let data = req.url.split("/");
    let outcomes = [
      {position: 1, check: "", page: "index", asset: "index.html"}, // intial index load
      {position: 1, check: "favicon.ico", page: "global", asset: "favicon.ico"}, // initial favicon request
      {position: 0, check: "", page: data[1], asset: "index.html"} // intial page load
    ]
    try {
      if (data[2]) {throw error} // normal page request
      let correct = outcomes.find(o => data[o.position] == o.check);
      page = correct.page, asset = correct.asset
    } catch { // page and asset already set
      page = data[1], asset = data[2]
    }
    console.log(page," : ", asset)
    try { // content exists
      let details = paths.pages[page].find(a => a.alias == asset);
      if (paths.types[details.ext].split("/")[0] == "image") { // image type
        serve_img(req, res, details)
      } else {
        serve_asset(res, {page: page, asset: asset})
      }
    } catch { // page does not exist
      serve_asset(req, res, {page: "404", asset: "index.html"})
    }
  }
}

// init server
var server = http.createServer((req, res) => {handle(req, res)});
initPages()
server.listen(config.port)
