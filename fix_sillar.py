import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Check dist file
_, out, _ = c.exec_command('ls -la /var/www/sillar/dist/index.cjs', timeout=10)
print("dist:", out.read().decode().strip())

# Check sillar errors
_, out2, _ = c.exec_command('pm2 logs sillar --err --nostream --lines 10', timeout=15)
print("=== sillar errors ===")
print(out2.read().decode())

# Check build script to understand why it broke sillar
_, out3, _ = c.exec_command('cat /var/www/sillar/script/build.ts 2>/dev/null | head -50', timeout=10)
print("=== build script ===")
print(out3.read().decode())

c.close()
