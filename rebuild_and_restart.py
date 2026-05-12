import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

print("Building sillar...")
_, out, err = c.exec_command('cd /var/www/sillar && npm run build 2>&1', timeout=120)
build_out = out.read().decode()
print(build_out[-2000:] if len(build_out) > 2000 else build_out)

print("\nRestarting sillar...")
_, out2, _ = c.exec_command('pm2 restart sillar', timeout=30)
print(out2.read().decode())

time.sleep(3)

# Check status
_, out3, _ = c.exec_command('pm2 list --no-color | grep sillar', timeout=10)
print("\nStatus:")
print(out3.read().decode())

# Verify WhatsApp code in new dist
_, out4, _ = c.exec_command('grep -c "send_whatsapp" /var/www/sillar/dist/index.cjs', timeout=10)
print(f"\nsend_whatsapp in dist: {out4.read().decode().strip()} occurrences")

_, out5, _ = c.exec_command('grep -c "WhatsApp not configured" /var/www/sillar/dist/index.cjs', timeout=10)
print(f"Error messages: {out5.read().decode().strip()} occurrences")

c.close()
