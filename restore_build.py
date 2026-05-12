import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Check if dist is tracked in git
print("=== checking git for dist ===")
_, out, _ = c.exec_command('cd /var/www/sillar && git ls-files dist/ | head -5', timeout=10)
print(out.read().decode())

# Try restoring from git
_, out2, _ = c.exec_command('cd /var/www/sillar && git checkout HEAD -- dist/ 2>&1', timeout=15)
result = out2.read().decode()
print("restore result:", result)

# Check if restored
_, out3, _ = c.exec_command('ls -la /var/www/sillar/dist/ 2>/dev/null | head -5', timeout=10)
print("dist contents:", out3.read().decode())

c.close()
