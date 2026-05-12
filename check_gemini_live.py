import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Get fresh logs - look for GeminiLive
_, out, _ = c.exec_command('tail -50 /root/.pm2/logs/sillar-error.log', timeout=10)
print("=== ERRORS ===")
print(out.read().decode())

# Check latest out logs for GeminiLive messages
_, out2, _ = c.exec_command('grep "GeminiLive\|gemini" /root/.pm2/logs/sillar-out.log | tail -20', timeout=10)
print("=== GEMINI OUT LOGS ===")
print(out2.read().decode())

c.close()
