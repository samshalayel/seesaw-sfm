import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Direct DB check - exact values
cmd = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT ultramsg_instance_id, ultramsg_token, ultramsg_phone FROM rooms WHERE room_id='room-1772205132778-njgyy';" """
_, out, _ = c.exec_command(cmd, timeout=10)
print("=== DB raw values ===")
print(out.read().decode())

# Check if the columns actually exist in the table
cmd2 = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "\d rooms" | grep ultramsg"""
_, out2, _ = c.exec_command(cmd2, timeout=10)
print("=== Column definitions ===")
print(out2.read().decode())

# Test the API with verbose output
cmd3 = '''curl -s http://localhost:3000/api/vault-settings \
  -H "x-room-id: room-1772205132778-njgyy" \
  -H "x-debug: true" | python3 -c "
import sys, json
d = json.load(sys.stdin)
# Print whatsapp and vps sections
print(json.dumps({
  'whatsapp': d.get('whatsapp'),
  'vps_host': d.get('vps', {}).get('host')
}, indent=2))
"'''
_, out3, _ = c.exec_command(cmd3, timeout=15)
print("=== Vault API response (whatsapp + vps) ===")
print(out3.read().decode())

c.close()
