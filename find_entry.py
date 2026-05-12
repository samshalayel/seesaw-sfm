import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check manifest
_, out, _ = c.exec_command('ls /var/www/sillar/dist/public/.vite/ 2>/dev/null || echo "no .vite dir"', timeout=10)
print("vite dir:", out.read().decode())

# Check if index-kDpMdA33 or index-kNmBWfLt has the app entry (check for "root" div mounting)
_, out2, _ = c.exec_command('grep -c "document.getElementById" /var/www/sillar/dist/public/assets/index-kDpMdA33.js', timeout=10)
print("kDpMdA33 getElementById count:", out2.read().decode().strip())

_, out3, _ = c.exec_command('grep -c "document.getElementById" /var/www/sillar/dist/public/assets/index-kNmBWfLt.js', timeout=10)
print("kNmBWfLt getElementById count:", out3.read().decode().strip())

# Look at the first 200 chars of each
_, out4, _ = c.exec_command('head -c 200 /var/www/sillar/dist/public/assets/index-kDpMdA33.js', timeout=10)
print("kDpMdA33 start:", out4.read().decode()[:100])

_, out5, _ = c.exec_command('head -c 200 /var/www/sillar/dist/public/assets/index-kNmBWfLt.js', timeout=10)
print("kNmBWfLt start:", out5.read().decode()[:100])

c.close()
