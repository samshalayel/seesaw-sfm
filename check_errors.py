import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Recent error logs
_, out, _ = c.exec_command('tail -30 /root/.pm2/logs/sillar-error.log', timeout=10)
print("=== RECENT ERRORS ===")
print(out.read().decode())

# Recent out logs for gemini/clickup
_, out2, _ = c.exec_command('tail -30 /root/.pm2/logs/sillar-out.log', timeout=10)
print("=== RECENT OUT ===")
print(out2.read().decode())

c.close()
