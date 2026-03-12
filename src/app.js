'use strict'

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors())
app.use(express.json())

// Serve static files
app.use(express.static(path.join(__dirname, '../public')))

// Serve QR images
app.use('/qr', express.static(path.join(__dirname, '../public/qr')))

// ── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0-simple' })
})

// ── Payment portal ──────────────────────────────────────────────────────────

app.get('/pay', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/pay.html'))
})

// ── SDKless API ─────────────────────────────────────────────────────────────

app.use('/offerwall-api/sdkless', require('./routes/api/sdkless'))

// ── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`✨ Offerwall SDKless POC running on port ${PORT}`)
})
