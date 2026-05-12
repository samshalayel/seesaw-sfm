import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Pull latest
print("Pulling latest...")
_, out, _ = c.exec_command('cd /var/www/sillar && git pull origin master 2>&1', timeout=20)
print(out.read().decode())

# Build server only
print("Building server...")
_, out2, _ = c.exec_command('cd /var/www/sillar && npx tsx script/build-server-only.ts 2>&1', timeout=120)
result = out2.read().decode()
print(result[-1000:] if len(result) > 1000 else result)

# Restart
print("Restarting sillar...")
_, out3, _ = c.exec_command('pm2 restart sillar', timeout=20)
print(out3.read().decode()[:200])

time.sleep(4)

# Verify
_, out4, _ = c.exec_command('''curl -s http://localhost:3000/api/vault-settings \
  -H "x-room-id: room-1772205132778-njgyy" | python3 -c "
import sys, json
d = json.load(sys.stdin)
wa = d.get(\'whatsapp\', {})
print(\'instanceId:\', wa.get(\'instanceId\'))
print(\'phone:\', wa.get(\'phone\'))
print(\'hasToken:\', wa.get(\'hasToken\'))
"''', timeout=15)
print("=== WhatsApp in vault ===")
print(out4.read().decode())

# Test WhatsApp endpoint
_, out5, _ = c.exec_command('''curl -s -X POST http://localhost:3000/api/vault-settings/test-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" -d "{}"''', timeout=15)
print("=== WhatsApp test ===")
print(out5.read().decode())

c.close()
