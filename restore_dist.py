import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Check if seesaw has dist
_, out, _ = c.exec_command('ls -la /var/www/seesaw/dist/ 2>/dev/null | head -10', timeout=10)
print("seesaw dist:")
print(out.read().decode())

# Copy dist from seesaw to sillar
print("Copying dist from seesaw to sillar...")
_, out2, err2 = c.exec_command('cp -r /var/www/seesaw/dist /var/www/sillar/', timeout=30)
print("out:", out2.read().decode())
print("err:", err2.read().decode()[:200])

# Verify
_, out3, _ = c.exec_command('ls -la /var/www/sillar/dist/', timeout=10)
print("sillar dist after copy:")
print(out3.read().decode())

# Restart sillar
print("Restarting sillar...")
_, out4, _ = c.exec_command('pm2 restart sillar', timeout=20)
print(out4.read().decode())

time.sleep(4)

# Check
_, out5, _ = c.exec_command('pm2 list --no-color | grep sillar', timeout=10)
print("Status:", out5.read().decode())

# Quick API test
_, out6, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/vault-settings -H "x-room-id: room-1772205132778-njgyy"', timeout=10)
print("API health:", out6.read().decode())

c.close()
