const api = require('./api.js');
const Events = require('events');
module.exports = class Worker extends Events {
  constructor(url, token, time) {
    super();
    this.url = url
    this.user = token
    this.timestamp = time

    this.db = require('mongoose').connect(this.url, {useNewUrlParser: true, useUnifiedTopology: true}).connection
  }

  pull(collection, search) {
    db.once('open', function() {
      console.log("connected to db")
      // we're connected!
    });
  }

  work(res, data) {
    if (Date.now() >= this.timestamp) { // auto-prune
      this.emit('invalidToken');
      return;
    } else {
      console.log(data.method)
      try {
        res.end(JSON.stringify({
          token: data.token,
          content: api[data.method](data) // will have to add async support
        }));
      } catch {
        res.end(404)
      }
    }
  }
}
