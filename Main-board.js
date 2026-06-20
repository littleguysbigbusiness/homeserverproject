const http = require('http');
const crypto = require('crypto');

// Dynamic port detection engine for Render Cloud
const WEB_PORT = process.env.PORT || 3000;
const SESSION_COOKIE_NAME = 'hub_secure_token';

// Master Access Profile Credentials
const MASTER_USER = 'Aiden';
const MASTER_PASS = 'admin123';

const activeSessions = new Set();
let lastMinecraftPingTime = 0;

function parseCookies(request) {
    const list = {};
    const rc = request.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
}

const server = http.createServer((req, res) => {
    const cookies = parseCookies(req);
    const sessionToken = cookies[SESSION_COOKIE_NAME];
    const isAuthenticated = activeSessions.has(sessionToken);

    // 🔗 UNBLOCKED API ENDPOINT: Receives live ping data from your MC machine
    if (req.url === '/api/ping' && req.method === 'POST') {
        lastMinecraftPingTime = Date.now();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ status: "synchronized", timestamp: lastMinecraftPingTime }));
    }

    // 🔗 API ENDPOINT: Feeds the current live state directly into the browser screen template
    if (req.url === '/api/mc-status') {
        const isOnline = (Date.now() - lastMinecraftPingTime) < 45000; // Online if pinged in last 45 secs
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ online: isOnline }));
    }

    if (req.method === 'POST' && req.url === '/api/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const params = new URLSearchParams(body);
                const user = params.get('username');
                const pass = params.get('password');

                if (user === MASTER_USER && pass === MASTER_PASS) {
                    const token = crypto.randomBytes(24).toString('hex') + '_' + Date.now();
                    activeSessions.add(token);
                    res.writeHead(302, {
                        'Set-Cookie': `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
                        'Location': '/'
                    });
                    return res.end();
                } else {
                    res.writeHead(302, { 'Location': '/login?error=invalid' });
                    return res.end();
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                return res.end('Auth Error');
            }
        });
        return;
    }

    if (req.url === '/logout') {
        if (sessionToken) activeSessions.delete(sessionToken);
        res.writeHead(302, {
            'Set-Cookie': `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
            'Location': '/login'
        });
        return res.end();
    }

    if (!isAuthenticated && req.url !== '/login' && !req.url.startsWith('/api/')) {
        res.writeHead(302, { 'Location': '/login' });
        return res.end();
    }

    if (req.url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><title>Central Hub - Login</title>
    <style>body { font-family: 'Segoe UI', sans-serif; background: radial-gradient(circle, #0f172a 0%, #020617 100%); color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; } .card { background: rgba(30,41,59,0.4); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); padding: 40px; border-radius: 24px; width: 100%; max-width: 400px; text-align: center; } h1 { color: #38bdf8; margin: 0 0 10px 0; } input { width: 100%; padding: 14px; margin: 10px 0; background: #0f172a; border: 1px solid #334155; border-radius: 12px; color: #fff; box-sizing: border-box; } .btn { width: 100%; padding: 14px; background: #0284c7; border: none; border-radius: 12px; color: #fff; font-weight: bold; cursor: pointer; }</style>
</head>
<body>
    <div class="card">
        <h1>CENTRAL HUB</h1><p>Authentication Required</p>
        <form action="/api/login" method="POST">
            <input type="text" name="username" placeholder="User Identifier" required>
            <input type="password" name="password" placeholder="Security Key" required>
            <button type="submit" class="btn">Authenticate Connection</button>
        </form>
    </div>
</body>
</html>`);
    }

    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><title>Central Operations</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #020617; color: #f8fafc; padding: 30px; }
        .header { display: flex; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; max-width: 900px; margin: 40px auto; }
        .card { background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 20px; text-align: center; position: relative; }
        .btn { display: block; padding: 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; border-radius: 10px; color: #38bdf8; text-decoration: none; margin-top: 20px; font-weight: bold; }
        .btn:hover { background: #38bdf8; color: #020617; }
        .status-badge { font-weight: bold; padding: 4px 10px; border-radius: 6px; font-size: 12px; display: inline-block; margin-top: 10px; }
        .online { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
        .offline { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }
    </style>
</head>
<body>
    <div class="header"><h3>OPERATOR: ${MASTER_USER}</h3><a href="/logout" style="color:#fca5a5;">Terminate Session</a></div>
    <div class="grid">
        <div class="card">
            <h3>🗄️ Private NAS Storage</h3>
            <p>Targeting Host Machine IPv6 Network Nodes</p>
            <a href="http:/192.168.0.121:8080" target="_blank" class="btn">Access Storage Deck</a>
        </div>
        <div class="card" id="mc-card">
            <h3>🎮 Multiplayer Paper Server</h3>
            <p>High-Performance Dedicated World Matrix</p>
            <div id="mc-badge" class="status-badge offline">Checking Pulse...</div>
        </div>
    </div>
    <script>
        // Automatic polling client loop to check the state code from Render backend
        function checkMinecraftPulse() {
            fetch('/api/mc-status')
                .then(res => res.json())
                .then(data => {
                    const badge = document.getElementById('mc-badge');
                    if (data.online) {
                        badge.className = "status-badge online";
                        badge.textContent = "🟢 LIVE SYSTEM ACTIVE";
                    } else {
                        badge.className = "status-badge offline";
                        badge.textContent = "🔴 OFFLINE / DISCONNECTED";
                    }
                })
                .catch(() => {
                    document.getElementById('mc-badge').className = "status-badge offline";
                    document.getElementById('mc-badge').textContent = "⚠️ SYNC DROPPED";
                });
        }
        setInterval(checkMinecraftPulse, 5000);
        checkMinecraftPulse();
    </script>
</body>
</html>`);
    }
});

server.listen(WEB_PORT, '0.0.0.0');
