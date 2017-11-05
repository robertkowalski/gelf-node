
/* eslint-env mocha */

'use strict'

const assert = require('assert')
const Gelf = require('../gelf.js')
const inflate = require('zlib').inflate
const EventEmitter = require('events')
const dgram = require('dgram')

describe('Gelf', () => {
  it('should be an instance of EventEmitter', () => {
    const gelf = new Gelf(null)

    assert.ok(gelf instanceof EventEmitter)
  })

  it('should send message buffers by udp', (done) => {
    const graylogStdPort = 12201

    const server = dgram.createSocket('udp4')

    server.on('message', function (msg, rinfo) {
      assert.equal(msg.toString(), 'bar')
      server.close()
      gelf.closeSocket()
      done()
    })

    server.bind(graylogStdPort)

    const gelf = new Gelf(null)
    gelf.send(Buffer.from('bar'))
  })

  it('should deflate strings and call the callback afterwards', (done) => {
    const gelf = new Gelf(null)

    gelf.compress('pineapple', (err, res) => {
      if (err) throw err

      inflate(res, (err, buf) => {
        if (err) throw err

        assert.equal(buf.toString(), 'pineapple')
        done()
      })
    })
  })

  it('should emit an error if addiontal parameter is named _id', (done) => {
    const gelf = new Gelf()

    gelf.on('error', (err) => {
      assert.equal(err.message, '_id is not allowed')
      gelf.closeSocket()
      done()
    })

    gelf.emit('gelf.log', { _id: 'furbie' })
  })

  it('prepares chunks according to the given chunksize', () => {
    const gelf = new Gelf()

    assert.deepEqual(
      gelf.getChunks('123456789', 2),
      [['1', '2'], ['3', '4'], ['5', '6'], ['7', '8'], ['9']]
    )

    assert.deepEqual(
      gelf.getChunks('1234567890', 2),
      [['1', '2'], ['3', '4'], ['5', '6'], ['7', '8'], ['9', '0']]
    )

    gelf.closeSocket()
  })

  it('should chunk if message is larger than maxSize', () => {
    const gelf = new Gelf({
      graylogPort: 12201,
      graylogHostname: '127.0.0.1',
      connection: 'wan',
      maxChunkSizeWan: 10,
      maxChunkSizeLan: 8154
    })

    const buf = Buffer.from('mr. lampe has left the building!!!!!!11111elf')
    const res = gelf.maybeChunkMessage(buf)

    assert.ok(Array.isArray(res))
    gelf.closeSocket()
  })

  it('no chunking for small messages', () => {
    const gelf = new Gelf({
      graylogPort: 12201,
      graylogHostname: '127.0.0.1',
      connection: 'wan',
      maxChunkSizeWan: 100,
      maxChunkSizeLan: 8154
    })

    const buf = Buffer.from('mr. lampe! hey hey!')
    const res = gelf.maybeChunkMessage(buf)

    assert.ok(!Array.isArray(res), 'no array')
    gelf.closeSocket()
  })

  it('integration test, short format', (done) => {
    const graylogStdPort = 12201

    const server = dgram.createSocket('udp4')

    server.on('message', function (msg, rinfo) {
      inflate(msg, (err, buf) => {
        if (err) throw err

        const res = JSON.parse(buf.toString())
        assert.equal(res.short_message, 'hallo hauke')
        server.close()
        gelf.closeSocket()
        done()
      })
    })

    server.bind(graylogStdPort)

    const gelf = new Gelf(null)
    gelf.emit('gelf.log', 'hallo hauke')
  })

  it('integration test, long format', (done) => {
    const graylogStdPort = 12201

    const server = dgram.createSocket('udp4')

    server.on('message', function (msg, rinfo) {
      inflate(msg, (err, buf) => {
        if (err) throw err

        const res = JSON.parse(buf.toString())
        assert.equal(res.short_message, 'pineapple')
        server.close()
        gelf.closeSocket()
        done()
      })
    })

    server.bind(graylogStdPort)

    const gelf = new Gelf(null)
    gelf.emit('gelf.log', {
      short_message: 'pineapple'
    })
  })
})
