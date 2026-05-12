import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)
time.sleep(5)
_, out, _ = c.exec_command('pm2 list --no-color', timeout=15)
print(out.read().decode())
c.close()
