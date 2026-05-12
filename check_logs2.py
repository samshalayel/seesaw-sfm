import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Search for POST requests to auto-trigger endpoints
cmd = r'grep -n "POST /api/auto-trigger\|POST /api/chat\|\[AutoTrigger\]\|\[Trigger\]\|scanNow\|processTask" /root/.pm2/logs/sillar-out.log | tail -50'
_, out, err = c.exec_command(cmd, timeout=30)
print("=== TRIGGER POSTS AND SCAN EVENTS ===")
print(out.read().decode())

# Check error log for any recent errors
cmd2 = r'tail -20 /root/.pm2/logs/sillar-error.log'
_, out2, _ = c.exec_command(cmd2, timeout=30)
print("\n=== RECENT ERROR LOG ===")
print(out2.read().decode())

c.close()
