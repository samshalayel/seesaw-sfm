import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

_, out, _ = c.exec_command('cat /var/www/sillar/script/build.ts', timeout=10)
print(out.read().decode())
c.close()
