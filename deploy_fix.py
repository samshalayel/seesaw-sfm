import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

cmd = '''
cd /var/www/sillar && git fetch origin master && git reset --hard origin/master && echo "OK: sillar"
cd /var/www/seesaw && git fetch origin master && git reset --hard origin/master && echo "OK: seesaw"
pm2 restart sillar seesaw
echo "DONE"
'''
_, out, err = c.exec_command(cmd, timeout=60)
print(out.read().decode())
stderr = err.read().decode()
if stderr:
    print("STDERR:", stderr[:300])
c.close()
