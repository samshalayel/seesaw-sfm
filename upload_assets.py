import paramiko, os, glob

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)
sftp = c.open_sftp()

base_local    = r'D:\seesaw-main\seesaw-main\dist'
# sillar (id:6) runs: node dist/index.cjs  from /var/www/sillar
# nginx serves static files from /var/www/sillar/dist/public
remote_static = '/var/www/sillar/dist/public'
remote_server = '/var/www/sillar/dist'

# Static files → /var/www/sillar/dist/public/
static_files = (
    glob.glob(os.path.join(base_local, 'public', 'assets', '*.js')) +
    glob.glob(os.path.join(base_local, 'public', 'assets', '*.css')) +
    [os.path.join(base_local, 'public', 'index.html')]
)

for lpath in static_files:
    rel   = os.path.relpath(lpath, os.path.join(base_local, 'public')).replace('\\', '/')
    rpath = remote_static + '/' + rel
    sftp.put(lpath, rpath)
    print(f'OK (static) {os.path.basename(lpath)}')

# Backend → /var/www/sillar/dist/index.cjs  (sillar id:6 reads from here)
server_file = os.path.join(base_local, 'index.cjs')
sftp.put(server_file, remote_server + '/index.cjs')
print(f'OK (server) index.cjs')

sftp.close()

# Restart sillar (id:6) — the actual production server
_, out, _ = c.exec_command('pm2 restart sillar', timeout=20)
print(out.read().decode().strip()[-200:] or 'restarted')

c.close()
print('DONE')
