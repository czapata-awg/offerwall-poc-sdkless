'use strict'

const crypto = require('crypto')

/**
 * Generates a cryptographically random alphanumeric token.
 * @param {number} length
 * @returns {string}
 */
const generateToken = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}

module.exports = { generateToken }
