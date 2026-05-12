import paramiko
import urllib.request
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Get the actual GitHub token from DB
cmd = 'PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT github_token FROM rooms WHERE room_id=\'room-1772205132778-njgyy\';"'
_, out, _ = c.exec_command(cmd, timeout=15)
result = out.read().decode()
print("=== DB token ===")
print(result)

# Extract token from output (line after "github_token" header)
lines = result.strip().split('\n')
token = ""
for i, line in enumerate(lines):
    if '---' in line and i+1 < len(lines):
        token = lines[i+1].strip()
        break

print(f"Token: {token[:15]}...")

# Test GitHub API
cmd2 = f'curl -s -o /dev/null -w "%{{http_code}}" -H "Authorization: token {token}" "https://api.github.com/repos/samshalayel/site"'
_, out2, _ = c.exec_command(cmd2, timeout=15)
status = out2.read().decode()
print(f"GitHub repo status: {status}")

# Check what repos the token can access
cmd3 = f'curl -s -H "Authorization: token {token}" "https://api.github.com/user/repos?per_page=20" | python3 -c "import sys,json; repos=json.load(sys.stdin); [print(r[\"full_name\"]) for r in repos]" 2>/dev/null || curl -s -H "Authorization: token {token}" "https://api.github.com/user/repos?per_page=20" | grep -o \'"full_name": "[^"]*"\' | head -20'
_, out3, _ = c.exec_command(cmd3, timeout=20)
print("=== Accessible repos ===")
print(out3.read().decode())

c.close()
