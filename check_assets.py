import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check if assets exist
_, out, _ = c.exec_command('ls /var/www/sillar/dist/public/assets/ | head -10', timeout=10)
print("=== sillar assets ===")
print(out.read().decode())

# Check if the specific JS file exists
_, out2, _ = c.exec_command('ls /var/www/sillar/dist/public/assets/ | grep index-D3HVffuW', timeout=10)
print("Specific file:", out2.read().decode())

# Test if nginx serves the file
_, out3, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://sillar.uk/assets/index-D3HVffuW.js', timeout=15)
print("HTTP status for JS:", out3.read().decode())

# Check nginx error log
_, out4, _ = c.exec_command('tail -10 /var/log/nginx/error.log', timeout=10)
print("=== nginx errors ===")
print(out4.read().decode())

c.close()
