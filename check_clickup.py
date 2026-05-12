import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check ClickUp token in DB
cmd = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT clickup_token, clickup_list_id, clickup_assignee FROM rooms WHERE room_id='room-1772205132778-njgyy';" """
_, out, _ = c.exec_command(cmd, timeout=10)
print("=== ClickUp config ===")
print(out.read().decode())

# Test directly
_, out2, _ = c.exec_command('''curl -s -w "\\n%{http_code}" http://localhost:3000/api/clickup/members \
  -H "x-room-id: room-1772205132778-njgyy"''', timeout=10)
print("=== API test ===")
print(out2.read().decode())

c.close()
