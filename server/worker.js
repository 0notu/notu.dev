
module.exports = class Worker {
  constructor(id, dbLink) {
    this.mongo = require('mongodb').MongoClient;
    this.user = id;
    this.databaseURL = dbLink;
  }

  // TODO: auto prune workers in ___ timeout (built into workers)

  async init() {
    let client = await this.mongo.connect(this.databaseURL, { useUnifiedTopology: true })
    console.log("connected to mongodb")
    this.db = client.db('site');
  }

  handle(req, res, data) {
    console.log(data.type)
    res.end("request received")
  }
}
