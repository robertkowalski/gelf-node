'use strict'

const deflate = require('zlib').deflate
const dgram = require('dgram')
const EventEmitter = require('events')
const os = require('os')
const async = require('async')

const defaults = {
  graylogPort: 12201,
  graylogHostname: '127.0.0.1',
  connection: 'wan',
  maxChunkSizeWan: 1420,
  maxChunkSizeLan: 8154
}

const GELF_MAGIC_NO = [ 0x1e, 0x0f ]

class Gelf extends EventEmitter {
  constructor (options) {
    super(options)

    this.config = options = Object.assign({}, defaults, options)
    this.client = this.openSocket()

    this.on('gelf.log', (json = {}, cb = () => {}) => {
      const msg = this.sanitizeMsg(json)
      setImmediate(() => {
        this.sendMessage(msg, cb)
      })
    })

    this.on('gelf.message', (msg, cb = () => {}) => {
      this.sendMessage(msg, cb)
    })
  }

  openSocket () {
    const client = dgram.createSocket('udp4')
    client.unref()
    return client
  }

  closeSocket () {
    this.client.close()
  }

  sendMessage (msg, cb) {
    this.compress(msg, (_, buf) => {
      const m = this.maybeChunkMessage(buf)
      this.send(m, cb)
    })
  }

  maybeChunkMessage (buf) {
    const {
      connection,
      maxChunkSizeWan,
      maxChunkSizeLan
    } = this.config

    const bufSize = buf.length

    if (connection === 'wan' && bufSize > maxChunkSizeWan) {
      const chunks = this.getChunks(buf, maxChunkSizeWan)
      return this.createPackets(chunks)
    }

    if (connection === 'lan' && bufSize > maxChunkSizeLan) {
      const chunks = this.getChunks(buf, maxChunkSizeLan)
      return this.createPackets(chunks)
    }

    return buf
  }

  send (msg, cb = () => {}) {
    const { graylogPort, graylogHostname } = this.config
    const client = this.client

    if (!Array.isArray(msg)) {
      msg = [ msg ]
    }

    const tasks = msg.map((m) => {
      const self = this
      return function task (cb) {
        client.send(m, 0, m.length, graylogPort, graylogHostname, (err) => {
          if (err) {
            return cb(err) && self.emitError(err)
          }

          return cb(null)
        })
      }
    })

    async.series(tasks, (err) => {
      if (err) return cb(err) && this.emitError(err)
      cb(null)
    })
  }

  compress (msg, cb = () => {}) {
    deflate(msg, (err, buf) => {
      if (err) {
        cb(err)
        return this.emitError(err)
      }

      cb(null, buf)
    })
  }

  getChunks (buf, chunkSize) {
    const res = []

    for (let index = 0; index < buf.length; index += chunkSize) {
      res.push(
        Array.prototype.slice.call(buf, index, index + chunkSize)
      )
    }

    return res
  }

  createPackets (chunks) {
    const res = []
    const count = chunks.length

    const msgId = Math.floor(
      Math.random() * (99999999 - 10000000)
    ) + 10000000

    chunks.forEach((chunk, index) => {
      res[index] = Buffer.from(
        GELF_MAGIC_NO.concat(msgId, index, count, chunk)
      )
    })

    return res
  }

  emitError (err) {
    this.emit('error', err)
  }

  sanitizeMsg (msg) {
    let json = {}

    json.short_message = msg.short_message

    if (typeof msg === 'string') {
      json.short_message = msg
    } else {
      json = Object.assign({}, json, msg)
    }

    if (msg._id) {
      return this.emitError(new Error('_id is not allowed'))
    }

    if (!msg.version) {
      json.version = '1.0'
    }

    if (!msg.host) {
      json.host = os.hostname()
    }

    if (!msg.timestamp) {
      json.timestamp = new Date().getTime() / 1000
    }

    if (!msg.facility) {
      json.facility = 'node.js'
    }

    if (!json.short_message) {
      json.short_message = 'Gelf Shortmessage'
    }

    return JSON.stringify(json)
  }
}

module.exports = Gelf
