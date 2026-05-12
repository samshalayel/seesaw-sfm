import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

cmd = 'PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT room_id, github_owner, github_repo, left(github_token,10) as token_prefix FROM rooms ORDER BY id LIMIT 15;"'
_, out, err = c.exec_command(cmd, timeout=15)
print("=== ROOMS GITHUB CONFIG ===")
print(out.read().decode())
print(err.read().decode()[:300])

c.close()
