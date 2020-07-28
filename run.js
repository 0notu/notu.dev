// init server
const fs = require('fs');
function requireJSON(path) { // readJSON cacheless
    return JSON.parse(fs.readFileSync(path, 'utf-8'))
};
  
const paths = requireJSON("./pages.json")
const secret = requireJSON("./config.json")
const types = requireJSON("./types.json")
const Server = require('./main.js');

const myServer = new Server(paths, secret, types);
myServer.init();