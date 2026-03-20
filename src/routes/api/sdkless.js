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

  // Delete old QR if exists
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }

  // Generate QR as data URL (smaller size)
  const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 150,
    color: { dark: '#ffffff', light: '#000000' },
  })

  // Create canvas with QR + text + padding (16:9 aspect ratio for video)
  const qrSize = 150
  const textHeight = 50
  const canvasWidth = 640 // Standard width for overlay
  const canvasHeight = 360 // 16:9 aspect ratio

  // Center the QR code in the canvas
  const horizontalPadding = (canvasWidth - qrSize) / 2
  const totalContentHeight = qrSize + textHeight
  const verticalPadding = (canvasHeight - totalContentHeight) / 2

  const canvas = createCanvas(canvasWidth, canvasHeight)
  const ctx = canvas.getContext('2d')

  // Black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Load QR image (centered horizontally)
  const qrImage = new Image()
  qrImage.src = qrDataUrl
  const qrX = horizontalPadding
  const qrY = verticalPadding
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

  // Draw text below QR (two lines, centered)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const line1 = 'Scan the QR code'
  const line2 = 'to access premium content'
  const textStartY = qrY + qrSize + 10 // 10px gap between QR and text

  ctx.fillText(line1, canvasWidth / 2, textStartY + 10)
  ctx.fillText(line2, canvasWidth / 2, textStartY + 30)

  // Save to file
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(filepath, buffer)

  // Return public URL to the QR image
  return `${baseUrl}/qr/${filename}`
}

module.exports = router
