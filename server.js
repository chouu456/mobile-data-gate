const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded ? forwarded.split(',')[0].trim() : req.ip || req.socket.remoteAddress || '');

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  return ip;
}

async function mobileDataOnly(req, res, next) {
  try {
    const clientIp = getClientIp(req);

    if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1') {
      return res.status(403).send(blockedPage(
        'Localhost Detected',
        'Open this through your live Render URL to test with a real mobile data IP.'
      ));
    }

    const apiUrl = `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,message,isp,mobile,proxy,hosting`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'success') {
      return res.status(503).send(blockedPage(
        'Verification Unavailable',
        'We could not verify your network connection right now. Please try again.'
      ));
    }

    if (data.mobile === true && data.proxy === false && data.hosting === false) {
      return next();
    }

    const reason = (data.proxy || data.hosting)
      ? 'a VPN, Proxy, or Hosting network'
      : `Wi-Fi / Broadband (${data.isp || 'Unknown ISP'})`;

    return res.status(403).send(blockedPage(
      'Mobile Data Only',
      `You are currently using <strong>${reason}</strong>. Please turn off Wi-Fi and any VPN, then switch to <strong>Mobile Data</strong> to open this website.`
    ));
  } catch (err) {
    console.error('Network check failed:', err.message);
    return res.status(500).send(blockedPage(
      'Connection Check Error',
      'Something went wrong while checking your network. Please reload and try again.'
    ));
  }
}

app.get('/', mobileDataOnly, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected-site.html'));
});

function blockedPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mobile Data Required</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 20px;
    }
    .card {
      max-width: 440px; width: 100%; background: #1e293b; border: 1px solid #334155;
      border-radius: 14px; padding: 32px; text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,0.4);
    }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h1 { margin: 0 0 12px; font-size: 24px; color: #f87171; }
    p { margin: 0 0 24px; color: #cbd5e1; line-height: 1.6; }
    button {
      background: #2563eb; color: #fff; border: 0; border-radius: 8px;
      padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶🚫</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <button onclick="window.location.reload()">I Switched to Mobile Data</button>
  </div>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
                              
