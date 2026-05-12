import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check if send_whatsapp tool is in dist
cmd = 'grep -c "send_whatsapp" /var/www/sillar/dist/index.cjs'
_, out, _ = c.exec_command(cmd, timeout=10)
count = out.read().decode().strip()
print(f"send_whatsapp occurrences in dist: {count}")

# Check if WhatsApp not configured message is there
cmd2 = 'grep -c "WhatsApp not configured" /var/www/sillar/dist/index.cjs'
_, out2, _ = c.exec_command(cmd2, timeout=10)
count2 = out2.read().decode().strip()
print(f"'WhatsApp not configured' occurrences in dist: {count2}")

# Show a snippet around send_whatsapp
cmd3 = 'grep -o ".\{50\}send_whatsapp.\{100\}" /var/www/sillar/dist/index.cjs | head -5'
_, out3, _ = c.exec_command(cmd3, timeout=10)
print("Context around send_whatsapp:")
print(out3.read().decode())

c.close()
