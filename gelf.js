var deflate = require('zlib').deflate,
    dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter,
    os = require('os'),
    crypto = require('crypto');

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

    if (json._id) {
      return self.emitError(Error('_id is not allowed'));
    }

    if (!json.version) {
      json.version = '1.0';
    }
    if (!json.host) {
      json.host = os.hostname();
    }
    if (!json.timestamp) {
      json.timestamp = new Date().getTime() / 1000;
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

Gelf.prototype = Object.create(EventEmitter.prototype, {
  constructor: {value: Gelf}
});

Gelf.prototype.compress = function(message, callback) {
  var self = this;
  deflate(message, function(err, buf) {
    if (err) {
      return self.emitError(err);
    }
    callback && callback(buf);
  });
};

Gelf.prototype.sendMessage = function(message) {
  var self = this,
      client = dgram.createSocket('udp4');

  client.send(message, 0, message.length, self.config.graylogPort, self.config.graylogHostname, function(err/*, bytes*/) {
    if (err) {
      return self.emitError(err);
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
      self.processMultipleChunks(buffer, config.maxChunkSizeWan);
      return;
    }
  } else if (self.config.connection === 'lan') {
    if (chunkSize > config.maxChunkSizeLan) {
      self.processMultipleChunks(buffer, config.maxChunkSizeLan);
      return;
    }
  }
  process.nextTick(function() {
    self.sendMessage(buffer);
  });
};

Gelf.prototype.processMultipleChunks = function(buffer, chunkSize) {
  var self = this,
      chunkArray,
      datagrams;

  chunkArray = self.prepareMultipleChunks(buffer, chunkSize);

  self.prepareDatagrams(chunkArray, function(err, datagrams) {
    if (err) {
      return self.emitError(err);
    }
    process.nextTick(function() {
      self.sendMultipleMessages(datagrams);
    });
  });
};

Gelf.prototype.prepareMultipleChunks = function(buffer, chunkSize) {
  var chunkArray = [],
      index;

  for (index = 0; index < buffer.length; index += chunkSize) {
    chunkArray.push(Array.prototype.slice.call(buffer, index, index + chunkSize));
  }

  return chunkArray;
};

Gelf.prototype.prepareDatagrams = function(chunkArray, callback) {
  var self = this,
      count = chunkArray.length,
      gelfMagicNumber = [0x1e, 0x0f],
      datagrams = [];

  var createDatagramArray = function(msgId) {
    chunkArray.forEach(function(chunk, index) {
      datagrams[index] = new Buffer(gelfMagicNumber.concat(msgId, index, count, chunk));
    });
    callback && callback(null, datagrams);
  };

  var randomBytesCallback = function(ex, buf) {
    if (ex) {
      return self.emitError(ex);
    }
    createDatagramArray(Array.prototype.slice.call(buf));
  };

  var getRandomBytes = function() {
    crypto.randomBytes(8, randomBytesCallback);
  };
  getRandomBytes();
};

Gelf.prototype.sendMultipleMessages = function(datagrams) {
  var self = this;

  datagrams.forEach(function(buffer) {
    self.sendMessage(buffer);
  });
};

Gelf.prototype.emitError = function(error) {
  this.emit('error', error);
};

module.exports = Gelf;