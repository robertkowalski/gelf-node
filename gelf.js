var deflate = require('zlib').deflate,
    dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter,
    os = require('os');

var Gelf = function(config) {
  var self = this;

  if (!config) {
    self.config = {
      graylogPort: 12201,
      graylogHostname: '127.0.0.1',
      connection: 'wan',
      maxChunkSizeWan: 1420,
      maxChunkSizeLan: 8154
    };
  } else {
    self.config = config;
  }

  /* test self.config */
  if (!self.config
      || !self.config.graylogPort
      || !self.config.graylogHostname
      || !self.config.connection
      || !self.config.maxChunkSizeWan
      || !self.config.maxChunkSizeLan) {
    throw new Error('config in constructor is missing values');
  }

  self.on('gelf.message', function(message) {
    self.compress(message, function(buffer) {
      self.processMessage(buffer);
    });
  });

  self.on('gelf.log', function(input) {
    var message,
        json;

    if (!input) {
      json = {};
    } else if (typeof input === 'string') {
      json = {};
      json.short_message = input;
    } else {
      json = input;
    }

    if (!json.version) {
      json.version = '1.0';
    }
    if (!json.host) {
      json.host = os.hostname();
    }
    if (!json.timestamp) {
      json.timestamp = new Date().getTime() * 1000;
    }
    if (!json.facility) {
      json.facility = 'node.js';
    }
    if (!json.short_message) {
      json.short_message = 'Gelf Shortmessage';
    }
    message = JSON.stringify(json);

    self.emit('gelf.message', message);
  });
};

Gelf.prototype.__proto__ = EventEmitter.prototype;

Gelf.prototype.compress = function(message, callback) {
  deflate(message, function(err, buf) {
    if (err) {
      throw err;
    }
    callback && callback(buf);
  });
};

Gelf.prototype.sendSingleMessage = function(message) {
  var self = this,
      client = dgram.createSocket('udp4');

  client.send(message, 0, message.length, self.config.graylogPort, self.config.graylogHostname, function(err, bytes) {
    if (err) {
      throw err;
    }
    client.close();
  });
};

Gelf.prototype.processMessage = function(buffer) {
  var self = this,
      config = self.config,
      chunkSize = buffer.length;

  if (config.connection === 'wan') {
    if (chunkSize > config.maxChunkSizeWan) {
        self.prepareMultipleChunks(buffer, config.maxChunkSizeWan, self.sendMultipleChunks);
        return;
    }
  } else if (self.config.connection === 'lan') {
    if (chunkSize > config.maxChunkSizeLan) {
        self.prepareMultipleChunks(buffer, config.maxChunkSizeLan, self.sendMultipleChunks);
        return;
    }
  }
  self.sendSingleMessage(buffer);
};

Gelf.prototype.prepareMultipleChunks = function(buffer, chunkSize, callback) {
  var chunkArray = [],
      index;

  for (index = 0; index < buffer.length; index += chunkSize) {
    chunkArray.push(buffer.slice(index, index + chunkSize));
  }

  callback && callback(chunkArray);
};

Gelf.prototype.getMessageId = function() {
  return new Date().getTime() * 1000 + '' + Math.ceil(10000 * Math.random());
};

Gelf.prototype.sendMultipleChunks = function() {

};

module.exports = Gelf;