import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check how PM2 starts sillar
cmd = 'pm2 show sillar | grep -E "script|exec|command|cwd|interpreter"'
_, out, _ = c.exec_command(cmd, timeout=15)
print("=== PM2 sillar config ===")
print(out.read().decode())

# Test the WhatsApp send via the API endpoint
cmd2 = '''curl -s -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" \
  -d '{"to":"+970599628317","message":"test من الـ API"}'
'''
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== WhatsApp API test ===")
print(out2.read().decode())

c.close()
