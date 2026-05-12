import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Test vault settings endpoint for WhatsApp
cmd = '''curl -s http://localhost:3000/api/vault-settings \
  -H "x-room-id: room-1772205132778-njgyy" | python3 -c "
import sys, json
d = json.load(sys.stdin)
wa = d.get('whatsapp', {})
print('instanceId:', wa.get('instanceId','(empty)'))
print('token:', '(set)' if wa.get('token') else '(empty)')
print('phone:', wa.get('phone','(empty)'))
"'''
_, out, _ = c.exec_command(cmd, timeout=15)
print("=== Vault WhatsApp settings ===")
print(out.read().decode())

# Test test-whatsapp endpoint
cmd2 = '''curl -s -X POST http://localhost:3000/api/vault-settings/test-whatsapp \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" \
  -d '{}'
'''
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== Test WhatsApp endpoint ===")
print(out2.read().decode())

c.close()
