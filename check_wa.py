import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

cmd = '''PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT room_id, ultramsg_instance_id, left(ultramsg_token,10) as token_prefix, ultramsg_phone FROM rooms WHERE room_id='room-1772205132778-njgyy';"'''
_, out, _ = c.exec_command(cmd, timeout=15)
print("=== WhatsApp Config in DB ===")
print(out.read().decode())

c.close()
