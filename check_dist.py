import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check dist file timestamp
cmd = 'ls -la /var/www/sillar/dist/index.cjs | head -3'
_, out, _ = c.exec_command(cmd, timeout=10)
print("=== dist/index.cjs timestamp ===")
print(out.read().decode())

# Check if send_whatsapp is in the compiled file
cmd2 = 'grep -o "send_whatsapp\\|WhatsApp not configured\\|ultramsguInstanceId\\|ultramsg" /var/www/sillar/dist/index.cjs | head -10'
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== send_whatsapp in dist/index.cjs ===")
result = out2.read().decode()
print(result if result else "(NOT FOUND - needs rebuild!)")

# Check git log vs dist timestamp
cmd3 = 'cd /var/www/sillar && git log --oneline -3'
_, out3, _ = c.exec_command(cmd3, timeout=10)
print("=== git log ===")
print(out3.read().decode())

c.close()
