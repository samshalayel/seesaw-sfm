import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Restart sillar
_, out, _ = c.exec_command('pm2 restart sillar', timeout=20)
print(out.read().decode())

time.sleep(4)

# Verify new dist has our changes
_, out2, _ = c.exec_command('grep -c "triggerRoomId" /var/www/sillar/dist/index.cjs', timeout=10)
print(f"triggerRoomId occurrences: {out2.read().decode().strip()}")

_, out3, _ = c.exec_command('grep -c "WhatsApp not configured" /var/www/sillar/dist/index.cjs', timeout=10)
print(f"WhatsApp error occurrences: {out3.read().decode().strip()}")

# Check API health
_, out4, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/vault-settings -H "x-room-id: room-1772205132778-njgyy"', timeout=10)
print(f"API health: {out4.read().decode().strip()}")

# Test WhatsApp test endpoint
_, out5, _ = c.exec_command('''curl -s -X POST http://localhost:3000/api/vault-settings/test-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" \
  -d "{}"''', timeout=15)
print(f"WhatsApp test: {out5.read().decode()}")

c.close()
