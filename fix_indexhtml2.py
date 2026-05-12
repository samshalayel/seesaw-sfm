import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Check vite manifest to find the correct entry
_, out, _ = c.exec_command('cat /var/www/sillar/dist/public/.vite/manifest.json 2>/dev/null | python3 -c "import sys,json; m=json.load(sys.stdin); [print(k,\"->\",v.get(\'file\')) for k,v in m.items() if \'index\' in k.lower() or v.get(\'isEntry\')]" 2>/dev/null | head -10', timeout=10)
print("=== Vite manifest entries ===")
print(out.read().decode())

# Grep for "App" in both files to find which is the real entry
_, out2, _ = c.exec_command('grep -l "createRoot\|ReactDOM\|hydrateRoot" /var/www/sillar/dist/public/assets/index-*.js 2>/dev/null', timeout=10)
print("=== React root entry ===")
print(out2.read().decode())

c.close()
