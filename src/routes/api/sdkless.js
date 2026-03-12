'use strict'

/**
 * Offerwall SDKLess / Video — Simple POC
 *
 * GET /sdkless-api/session?contentid=1&euid=user123&pubid=2
 *   → Returns { url_qr, url_content }
 */

const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')
const db = require('../../db')
const { generateToken } = require('../../utils/token')

const QR_DIR = process.env.QR_IMAGES_DIR || path.join(__dirname, '../../../public/qr')

// Ensure QR directory exists
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true })
}

// ── GET /offerwall-api/sdkless/session ────────────────────────────────────────

router.get('/session', async (req, res) => {
  const { contentid, euid, pubid } = req.query

  if (!contentid || !euid || !pubid) {
    return res.status(400).json({ message: 'Missing contentid, euid or pubid' })
  }

  try {
    // 1. Find video by content_id
    const video = await db.getVideo(contentid)

    if (!video) {
      return res.status(404).json({ message: 'Content not found' })
    }

    // 2. Check for existing session
    let session = await db.getSession(euid)

    if (!session) {
      // 3. Create new session
      const sessionToken = generateToken(16)

      session = await db.createSession({
        euid,
        pubid,
        contentid,
        session_token: sessionToken,
        paid: false,
        created_at: new Date().toISOString()
      })
    }

    // 4. Generate QR and save to filesystem
    const qrUrl = await generateAndSaveQR(session.session_token, euid, pubid)

    // 5. Return response
    res.json({
      url_qr: qrUrl,
      url_content: video.url
    })
  } catch (err) {
    console.error('[sdkless/session]', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Generate QR code, save to filesystem, and return public URL
 */
async function generateAndSaveQR(sessionToken, euid, pubid) {
  const baseUrl = process.env.BASE_URL || 'https://awgdevelop.ddns.net'
  const paymentUrl = `${baseUrl}/pay?euid=${encodeURIComponent(euid)}&publisher=${encodeURIComponent(pubid)}`

  const filename = `${sessionToken}.png`
  const filepath = path.join(QR_DIR, filename)

  // Generate and save QR as PNG file
  await QRCode.toFile(filepath, paymentUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
    color: { dark: '#000000', light: '#ffffff' },
  })

  // Return public URL to the QR image
  return `${baseUrl}/qr/${filename}`
}

module.exports = router
