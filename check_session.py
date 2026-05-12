import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check active meeting session
_, out, _ = c.exec_command('''curl -s http://localhost:3000/api/meeting/ai-status/room-1772205132778-njgyy \
  -H "x-room-id: room-1772205132778-njgyy"''', timeout=10)
print("Session status:", out.read().decode())

# Try to stop the session
_, out2, _ = c.exec_command('''curl -s -X POST http://localhost:3000/api/meeting/ai-stop \
  -H "Content-Type: application/json" \
  -H "x-room-id: room-1772205132778-njgyy" \
  -d '{"roomId":"room-1772205132778-njgyy"}'
''', timeout=10)
print("Stop result:", out2.read().decode())

# Check Gemini key in DB
_, out3, _ = c.exec_command('''PGPASSWORD=123456 psql -h localhost -U postgres -d seesaw -c "SELECT name, left(api_key,10) as key_prefix, model_id FROM room_models WHERE room_id='room-1772205132778-njgyy';"''', timeout=10)
print("=== Models ===")
print(out3.read().decode())

c.close()
