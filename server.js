const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(express.json({ limit: '5mb' }));

const BROADBAND_KEYWORDS = [
  'broadband',
  'fiber',
  'fibre',
  'dsl',
  'adsl',
  'vdsl',
  'cable',
  'ftth',
  'fttx',
  'act fibernet',
  'hathway',
  'tikona',
  'excitel',
  'you broadband',
  'alliance broadband',
  'wishnet',
  'gtpl',
  'spectra',
  'comcast',
  'verizon fios',
  'at&t internet',
  'spectrum',
  'cox',
  'bt ',
  'virgin media',
  'sky broadband'
];

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function isLocalIp(ip) {
  return (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

async function mobileDataOnly(req, res, next) {
  try {
    const clientIp = getClientIp(req);

    if (isLocalIp(clientIp)) {
      return next();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,mobile,proxy,hosting,isp,org`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await response.json();

    if (data && data.status === 'success') {
      const ispText = `${data.isp || ''} ${data.org || ''}`.toLowerCase();
      const isBroadbandIsp = BROADBAND_KEYWORDS.some((kw) => ispText.includes(kw));

      if (data.mobile === true && !data.proxy && !data.hosting && !isBroadbandIsp) {
        return next();
      }
    }

    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Mobile Data Only</title>
        <style>
          body {
            margin: 0;
            min-height: 100dvh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(155deg, #fff0f4 0%, #ffdbe4 50%, #ffc8d6 100%);
            color: #9f1239;
            text-align: center;
          }
          .box {
            max-width: 420px;
            padding: 32px 24px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.85);
            box-shadow: 0 20px 50px rgba(159, 18, 57, 0.15);
          }
          h1 { margin: 0 0 10px; font-size: 24px; }
          p { margin: 0; font-size: 15px; line-height: 1.5; color: #881337; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Mobile Data Only</h1>
          <p>Turn off Wi-Fi and open this link using mobile data.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(503).send('Unable to verify mobile connection. Please try again on mobile data.');
  }
}

app.get('/', mobileDataOnly, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected-site.html'));
});

app.post('/wrong-answer', mobileDataOnly, (req, res) => {
  const { question, guess, timestamp } = req.body || {};
  if (typeof guess === 'string' && guess.trim()) {
    console.log(`[WRONG ANSWER] ${timestamp || ''} | Q: "${question || ''}" | Guess: "${guess.trim()}"`);
  }
  res.sendStatus(204);
});

app.post('/wrong-snapshot', mobileDataOnly, (req, res) => {
  const { question, guess, imageBase64, timestamp } = req.body || {};
  console.log(
    `[WRONG SNAPSHOT] ${timestamp || ''} | Q: "${question || ''}" | Guess: "${guess || ''}" | Bytes: ${imageBase64 ? imageBase64.length : 0}`
  );
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
      
