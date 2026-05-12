import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check if $ signs are actually in the file
_, out, _ = c.exec_command(r"grep 'http_upgrade\|proxy_set_header Upgrade' /etc/nginx/sites-available/seesaw", timeout=10)
result = out.read().decode()
print("grep result:", repr(result))

# Check raw bytes around the Upgrade line
_, out2, _ = c.exec_command(r"grep -n 'Upgrade\|Host\|Forwarded' /etc/nginx/sites-available/seesaw | head -20", timeout=10)
print("raw grep:")
print(out2.read().decode())

c.close()
