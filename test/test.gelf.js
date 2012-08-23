var chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    Gelf = require('../gelf'),
    inflate = require('zlib').inflate,
    os = require('os');

chai.use(sinonChai);
var expect = chai.expect;

describe('Gelf', function(done) {

  afterEach(function() {

  });

  it('should be an instance of EventEmitter', function() {
    var gelf = new Gelf(null);
    var EventEmitter = require('events').EventEmitter;

    expect(gelf instanceof EventEmitter).to.equal(true);
  });

  it('should send message buffers by udp', function(done) {
    var graylogStdPort = 12201;
    var graylogStdHost = 'localhost';

    var dgram = require('dgram');
    var server = dgram.createSocket('udp4');

    server.on('message', function (msg, rinfo) {
      /* Expect a message arrives at the server */
      expect(msg.toString()).to.equal('bar');
      done();
    });
    server.bind(graylogStdPort);

    var gelf = new Gelf(null);
    gelf.sendMessage(new Buffer('bar'));
  });

  it('should emit and receive events with attached event listeners', function(done) {
    var gelf = new Gelf(null);

    gelf.on('graylogmessage', function(message) {
      expect(message).to.equal('meh');
      done();
    });

    gelf.emit('graylogmessage', 'meh');
  });

  it('should deflate strings and call the callback afterwards', function(done) {
    var gelf = new Gelf(null);

    var callback = function(buffer) {
      inflate(buffer, function(err, buf) {
        expect(buf.toString()).to.equal('bla');
        done();
      });
    };

    gelf.compress('bla', callback);
  });

  it('should add missing properties to the gelf-json', function(done) {
    var gelf = new Gelf(null);

    sinon.stub(gelf, 'compress', function(message) {
      var json = JSON.parse(message);
      expect(json.version).to.equal('1.0');
      expect(json.host).to.equal(os.hostname());
      expect(json.facility).to.equal('node.js');
      expect(json.short_message).to.equal('Gelf Shortmessage');

      done();
    });

    gelf.emit('gelf.log', null);
  });

  it('should handle a string as shortmessage', function(done) {
    var gelf = new Gelf(null);

    sinon.stub(gelf, 'compress', function(message) {
      var json = JSON.parse(message);

      expect(json.short_message).to.equal('Mr. Lampe has left the building.');

      done();
    });

    gelf.emit('gelf.log', 'Mr. Lampe has left the building.');
  });

  it('should throw an exception if config is incomplete', function() {
      var test = function() {
        new Gelf({"foo": "bar"});
      };

      expect(test).to.throw();
      expect(test).to.throw(Error);
  });

  it('should throw an exception if addiontal parameter is named _id', function() {
      var gelf = new Gelf();

      var test = function() {
        gelf.emit('gelf.log', {_id: 'bla'});
      };

      expect(test).to.throw();
      expect(test).to.throw(Error);
  });

  it('should call prepareMultipleChunks() if message larger than maxSize', function(done) {
    var gelf = new Gelf({
      graylogPort: 12201,
      graylogHostname: '127.0.0.1',
      connection: 'wan',
      maxChunkSizeWan: 10,
      maxChunkSizeLan: 8154
    });

    var stub = sinon.stub(gelf, 'prepareMultipleChunks', function() {

      expect(stub).to.have.been.calledOnce;
      done();
    });

    sinon.stub(gelf, 'prepareDatagrams');
    sinon.stub(gelf, 'sendMessage');
    sinon.stub(gelf, 'sendMultipleMessages');

    gelf.emit('gelf.log', 'mehgssssssggggggggguiguguigiugigigiugigigigig');
  });

  it('prepares chunks according to the given chunksize', function() {
    var gelf = new Gelf();

    expect(gelf.prepareMultipleChunks('123456789', 2)).to.deep.equal([['1', '2'], ['3', '4'], ['5', '6'], ['7', '8'], ['9']]);
    expect(gelf.prepareMultipleChunks('1234567890', 2)).to.deep.equal([['1', '2'], ['3', '4'], ['5', '6'], ['7', '8'], ['9', '0']]);
  });

});
