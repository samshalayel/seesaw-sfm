import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check nginx config for sillar.uk
_, out, _ = c.exec_command('cat /etc/nginx/sites-available/sillar.uk 2>/dev/null || cat /etc/nginx/sites-enabled/sillar.uk 2>/dev/null || grep -r "sillar.uk" /etc/nginx/ 2>/dev/null | head -3', timeout=10)
print("=== NGINX CONFIG ===")
print(out.read().decode())

# Check if nginx properly handles ws upgrade
_, out2, _ = c.exec_command('cat /etc/nginx/conf.d/*.conf 2>/dev/null | grep -A5 -i "websocket\|upgrade\|ws" | head -30', timeout=10)
print("=== NGINX WS SETTINGS ===")
print(out2.read().decode())

# Test the clickup/members endpoint
_, out3, _ = c.exec_command('''curl -s -w "\\n%{http_code}" http://localhost:3000/api/clickup/members \
  -H "x-room-id: room-1772205132778-njgyy" 2>&1 | tail -20''', timeout=10)
print("=== ClickUp members API ===")
print(out3.read().decode())

c.close()
