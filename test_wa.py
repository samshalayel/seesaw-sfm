import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Get full token
cmd = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -t -c "SELECT ultramsg_token FROM rooms WHERE room_id='room-1772205132778-njgyy';" """
_, out, _ = c.exec_command(cmd, timeout=10)
token = out.read().decode().strip()
print(f"Token: {token}")

# Test UltraMsg API - check instance status
cmd2 = f'curl -s "https://api.ultramsg.com/instance174562/instance/status?token={token}"'
_, out2, _ = c.exec_command(cmd2, timeout=15)
print("=== Instance Status ===")
print(out2.read().decode())

# Test sending
cmd3 = f'''curl -s -X POST "https://api.ultramsg.com/instance174562/messages/chat" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "token={token}" \
  --data-urlencode "to=+970599628317" \
  --data-urlencode "body=test من سيلار" \
  --data-urlencode "priority=10"'''
_, out3, _ = c.exec_command(cmd3, timeout=15)
print("=== Send Test ===")
print(out3.read().decode())

c.close()
