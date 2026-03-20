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
const { createCanvas, Image } = require('canvas')
const fs = require('fs')
const path = require('path')
const db = require('../../db')
const { generateToken } = require('../../utils/token')

const QR_DIR =
  process.env.QR_IMAGES_DIR || path.join(__dirname, '../../../public/qr')

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
        created_at: new Date().toISOString(),
      })
    }

    // 4. Generate QR and save to filesystem
    const qrUrl = await generateAndSaveQR(session.session_token, euid, pubid)

    // 5. Return response
    res.json({
      url_qr: qrUrl,
      url_content: video.url,
    })
  } catch (err) {
    console.error('[sdkless/session]', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Generate QR code with text, save to filesystem, and return public URL
 */
async function generateAndSaveQR(sessionToken, euid, pubid) {
  const baseUrl = process.env.BASE_URL || 'https://awgdevelop.ddns.net'
  const paymentUrl = `${baseUrl}/pay?euid=${encodeURIComponent(euid)}&publisher=${encodeURIComponent(pubid)}`

  const filename = `${sessionToken}.png`
  const filepath = path.join(QR_DIR, filename)

  // Generate QR as data URL
  const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: { dark: '#ffffff', light: '#000000' },
  })

  // Create canvas with QR + text
  const qrSize = 200
  const textHeight = 60
  const canvasWidth = qrSize
  const canvasHeight = qrSize + textHeight

  const canvas = createCanvas(canvasWidth, canvasHeight)
  const ctx = canvas.getContext('2d')

  // Black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Load QR image
  const qrImage = new Image()
  qrImage.src = qrDataUrl
  ctx.drawImage(qrImage, 0, 0, qrSize, qrSize)

  // Draw text below QR
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const text = 'Scan the QR code to access premium content'
  const textY = qrSize + textHeight / 2

  ctx.fillText(text, canvasWidth / 2, textY)

  // Save to file
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(filepath, buffer)

  // Return public URL to the QR image
  return `${baseUrl}/qr/${filename}`
}

module.exports = router
