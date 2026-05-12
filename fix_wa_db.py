import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Fix the WhatsApp config in DB
cmd = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "UPDATE rooms SET ultramsg_instance_id='instance174562', ultramsg_phone='+970599628317' WHERE room_id='room-1772205132778-njgyy';" """
_, out, _ = c.exec_command(cmd, timeout=10)
print("UPDATE:", out.read().decode())

# Verify
cmd2 = """PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT ultramsg_instance_id, ultramsg_phone FROM rooms WHERE room_id='room-1772205132778-njgyy';" """
_, out2, _ = c.exec_command(cmd2, timeout=10)
print("Verify:", out2.read().decode())

c.close()
