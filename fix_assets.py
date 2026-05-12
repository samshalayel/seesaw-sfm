import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Check what index.html references
_, out, _ = c.exec_command('grep "assets/index" /var/www/sillar/dist/public/index.html', timeout=10)
print("sillar index.html references:")
print(out.read().decode())

# Check seesaw index.html
_, out2, _ = c.exec_command('grep "assets/index" /var/www/seesaw/dist/public/index.html', timeout=10)
print("seesaw index.html references:")
print(out2.read().decode())

# Check seesaw assets
_, out3, _ = c.exec_command('ls /var/www/seesaw/dist/public/assets/ | grep "^index"', timeout=10)
print("seesaw index assets:", out3.read().decode())

# Check sillar assets
_, out4, _ = c.exec_command('ls /var/www/sillar/dist/public/assets/ | grep "^index"', timeout=10)
print("sillar index assets:", out4.read().decode())

c.close()
