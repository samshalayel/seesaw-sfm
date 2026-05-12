import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# See full index.html
_, out, _ = c.exec_command('cat /var/www/sillar/dist/public/index.html', timeout=10)
print("=== Current index.html ===")
print(out.read().decode())

# List all js files in assets
_, out2, _ = c.exec_command('ls /var/www/sillar/dist/public/assets/*.js | head -20', timeout=10)
print("=== JS files in assets ===")
print(out2.read().decode())

# Check file sizes to identify main bundle vs chunks
_, out3, _ = c.exec_command('ls -la /var/www/sillar/dist/public/assets/*.js | sort -k5 -rn | head -10', timeout=10)
print("=== JS files by size ===")
print(out3.read().decode())

c.close()
