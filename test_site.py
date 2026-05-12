import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Test the JS file is actually accessible
_, out, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code} %{size_download}" https://sillar.uk/assets/index-kDpMdA33.js', timeout=15)
print("JS file:", out.read().decode())

# Test CSS
_, out2, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code} %{size_download}" https://sillar.uk/assets/index-BOB7QVIH.css', timeout=15)
print("CSS file:", out2.read().decode())

# Test homepage
_, out3, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://sillar.uk/', timeout=15)
print("Homepage:", out3.read().decode())

c.close()
