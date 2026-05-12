import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check vault settings for WhatsApp specifically
cmd = '''curl -s http://localhost:3000/api/vault-settings \
  -H "x-room-id: room-1772205132778-njgyy" | python3 -c "
import sys,json
d=json.load(sys.stdin)
wa=d.get('whatsapp',{})
print('whatsapp:', wa)
print('instanceId:', repr(wa.get('instanceId','')))
print('token:', '(set)' if wa.get('token') else '(empty)')
print('phone:', wa.get('phone',''))
"'''
_, out, _ = c.exec_command(cmd, timeout=15)
print("=== Vault WhatsApp ===")
print(out.read().decode())

# Test WhatsApp test endpoint directly (with debug)
cmd2 = '''curl -s -v -X POST http://localhost:3000/api/vault-settings/test-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" \
  -d "{}" 2>&1 | grep -E "< HTTP|{.*}" | head -5'''
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== Test endpoint ===")
print(out2.read().decode())

c.close()
