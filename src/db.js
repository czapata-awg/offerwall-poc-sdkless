'use strict'

const fs = require('fs').promises
const path = require('path')

const DB_FILE = path.join(__dirname, '../data/db.json')

let db = null

// Load database
async function loadDB() {
  if (!db) {
    const data = await fs.readFile(DB_FILE, 'utf8')
    db = JSON.parse(data)
  }
  return db
}

// Save database
async function saveDB() {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

// Get video by content_id
async function getVideo(contentId) {
  await loadDB()
  return db.videos.find(v => v.content_id === contentId)
}

// Get session by euid
async function getSession(euid) {
  await loadDB()
  return db.sessions.find(s => s.euid === euid)
}

// Create session
async function createSession(sessionData) {
  await loadDB()
  db.sessions.push(sessionData)
  await saveDB()
  return sessionData
}

// Update session
async function updateSession(euid, updates) {
  await loadDB()
  const session = db.sessions.find(s => s.euid === euid)
  if (session) {
    Object.assign(session, updates)
    await saveDB()
    return session
  }
  return null
}

module.exports = {
  getVideo,
  getSession,
  createSession,
  updateSession
}
