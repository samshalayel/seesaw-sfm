import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check if send_whatsapp is in the deployed built code
cmd = 'grep -n "send_whatsapp\|WhatsApp not configured\|getWhatsAppConfig" /var/www/sillar/dist/index.js | head -20'
_, out, _ = c.exec_command(cmd, timeout=15)
print("=== send_whatsapp in dist ===")
print(out.read().decode())

# Check the source autoTrigger
cmd2 = 'grep -n "send_whatsapp\|WhatsApp not configured" /var/www/sillar/server/autoTrigger.ts | head -15'
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== autoTrigger.ts source ===")
print(out2.read().decode())

c.close()
