const urlParams = new URLSearchParams(window.location.search)
const euid = urlParams.get('euid')
const publisher = urlParams.get('publisher')

// Generate random 6-character alphanumeric session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const sessionId = generateSessionId()
let pollingInterval = null
let isPolling = false

if (!euid) {
  alert('Error: User not identified')
  document.getElementById('walletButton').disabled = true
  document.getElementById('movistarButton').disabled = true
}

async function payWithWallet() {
  // Show wallet screen
  document.getElementById('paymentScreen').classList.add('hidden')
  document.getElementById('walletScreen').classList.add('active')

  // Wait 5 seconds then call pay endpoint
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    const response = await fetch(`https://awgdevelop.ddns.net/hls/payment?euid=${encodeURIComponent(euid)}&pay=true`);
    const data = await response.json();
    console.log('Payment response:', data);

    if (data.status === 'success' && data.action === 'unlocked') {
      console.log('Payment confirmed by pay endpoint');
      alert('Thank you for your purchase, you can now enjoy the content!');
    }
  } catch (error) {
    console.error('Payment error:', error);
  }
}

async function payDirect() {
  const button = document.getElementById('payButton')

  // Disable button
  button.disabled = true
  button.innerHTML = 'Processing...'

  // Call pay endpoint
  try {
    const response = await fetch(
      `https://awgdevelop.ddns.net/hls/payment?euid=${encodeURIComponent(euid)}&pay=true`,
    )
    const data = await response.json()
    console.log('Payment response:', data)

    if (data.status === 'success' && data.action === 'unlocked') {
      console.log('Payment confirmed by pay endpoint')
      button.innerHTML = 'Paid'
      button.classList.add('paid')
      alert('Thank you for your purchase, you can now enjoy the content!')
    }
  } catch (error) {
    console.error('Payment error:', error)
    button.innerHTML = 'Pay'
    button.disabled = false
  }
}

function payWithMovistar() {
  // Show waiting screen
  document.getElementById('paymentScreen').classList.add('hidden')
  document.getElementById('waitingScreen').classList.add('active')
}

function sendSMS() {
  // Open SMS app with pre-filled message
  const smsBody = `OFFERW ${sessionId}`
  const smsUrl = `sms:4141?body=${encodeURIComponent(smsBody)}`
  window.location.href = smsUrl

  // Update UI to show waiting state
  document.getElementById('smsText').innerHTML =
    'Waiting for SMS to be sent<span class="spinner"></span>'
  document.getElementById('sendSmsButtonGroup').style.display = 'none'

  // Start polling
  if (!isPolling) {
    startPolling()
  }
}

function goBack() {
  // Cancel polling
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    isPolling = false
  }

  // Reset SMS screen to initial state
  document.getElementById('smsText').innerHTML =
    'Please send the SMS to complete your payment'
  document.getElementById('sendSmsButtonGroup').style.display = 'block'

  // Hide all screens and show payment screen
  document.getElementById('waitingScreen').classList.remove('active')
  document.getElementById('walletScreen').classList.remove('active')
  document.getElementById('paymentScreen').classList.remove('hidden')

  // Clear status messages
  const statusSms = document.getElementById('statusSms')
  if (statusSms) {
    statusSms.className = 'status'
    statusSms.innerHTML = ''
  }
}

function startPolling() {
  isPolling = true

  // Poll every 3 seconds
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(
        `https://awgreporting.com/offerwall-api/status?token=${euid}`,
      )
      const data = await response.json()

      if (response.ok && data.completed) {
        // Payment confirmed
        clearInterval(pollingInterval)
        isPolling = false

        // Call pay endpoint
        await callPayEndpoint()

        // Update session with URL and vendor
        await updateSession()

        // Show success message in SMS screen
        const statusSms = document.getElementById('statusSms')
        statusSms.className = 'status success'
        statusSms.innerHTML =
          'Thank you for your purchase, you can now enjoy the content!'

        // Hide the waiting text and button
        document.getElementById('smsText').style.display = 'none'
        document.getElementById('sendSmsButtonGroup').style.display = 'none'

        // Disable buttons after successful payment
        document.getElementById('walletButton').disabled = true
        document.getElementById('movistarButton').disabled = true
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, 3000)

  // Stop polling after 5 minutes
  setTimeout(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      isPolling = false
      const statusSms = document.getElementById('statusSms')
      statusSms.className = 'status error'
      statusSms.innerHTML = 'Payment timeout. Please try again.'
    }
  }, 300000) // 5 minutes
}

async function callPayEndpoint() {
  try {
    const response = await fetch(
      `https://awgdevelop.ddns.net/hls/payment?euid=${encodeURIComponent(euid)}&pay=true`,
    )
    const data = await response.json()
    console.log('Pay endpoint response:', data)

    if (data.status === 'success' && data.action === 'unlocked') {
      console.log('Payment confirmed by pay endpoint')
    }
  } catch (error) {
    console.error('Pay endpoint error:', error)
  }
}

async function updateSession() {
  try {
    const response = await fetch(
      `https://awgreporting.com/offerwall-api/update?sessionId=${euid}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: window.location.href,
          vendor: 'AR.MOVISTAR',
        }),
      },
    )

    const data = await response.json()
    console.log('Session updated:', data)
  } catch (error) {
    console.error('Update session error:', error)
  }
}
