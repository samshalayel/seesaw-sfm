import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Search for scan / task processing logs
cmd = r'grep -n -i -E "scan|processTask|Trigger|task.*found|clickup|permission|403|ClickUp|robot" /root/.pm2/logs/sillar-out.log | head -80'
_, out, err = c.exec_command(cmd, timeout=30)
print("=== AUTO-TRIGGER / CLICKUP MATCHES ===")
print(out.read().decode())

# Also check the chat route for any AI response with "permission"
cmd2 = r'grep -i "permission\|403\|صلاحية" /root/.pm2/logs/sillar-out.log | tail -20'
_, out2, err2 = c.exec_command(cmd2, timeout=30)
print("=== PERMISSION/403 MATCHES ===")
print(out2.read().decode())

c.close()
