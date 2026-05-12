import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Fix index.html - replace old hash with correct one
cmd = r"sed -i 's/index-D3HVffuW\.js/index-kDpMdA33.js/g' /var/www/sillar/dist/public/index.html"
_, out, _ = c.exec_command(cmd, timeout=10)
print("Fix sillar:", out.read().decode())

# Also fix seesaw just in case
cmd2 = r"sed -i 's/index-D3HVffuW\.js/index-kDpMdA33.js/g' /var/www/seesaw/dist/public/index.html"
_, out2, _ = c.exec_command(cmd2, timeout=10)
print("Fix seesaw:", out2.read().decode())

# Verify
_, out3, _ = c.exec_command('grep "assets/index" /var/www/sillar/dist/public/index.html', timeout=10)
print("Updated index.html:")
print(out3.read().decode())

# Test the site
_, out4, _ = c.exec_command('curl -s https://sillar.uk/ | grep "assets/index"', timeout=15)
print("Live site references:")
print(out4.read().decode())

c.close()
