'use strict'

const deflate = require('zlib').deflate
const dgram = require('dgram')
const EventEmitter = require('events')
const os = require('os')

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

    this.on('gelf.log', (json = {}) => {
      const msg = this.sanitizeMsg(json)
      setImmediate(() => {
        this.sendMessage(msg)
      })
    })

    this.on('gelf.message', (msg) => {
      this.sendMessage(msg)
    })
  }

  openSocket () {
    const client = dgram.createSocket('udp4')
    return client
  }

  closeSocket () {
    this.client.close()
  }

  sendMessage (msg) {
    this.compress(msg, (_, buf) => {
      const m = this.maybeChunkMessage(buf)
      this.send(m)
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

  send (msg) {
    const { graylogPort, graylogHostname } = this.config

    function push (msg) {
      this.client.send(msg, 0, msg.length, graylogPort, graylogHostname, (err) => {
        if (err) return this.emitError(err)
      })
    }

    if (Array.isArray(msg)) {
      msg.forEach((m) => {
        push.call(this, m)
      })

      return
    }

    push.call(this, msg)
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
    const json = {}

    json.short_message = msg.short_message

    if (typeof msg === 'string') {
      json.short_message = msg
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
