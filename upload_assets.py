import paramiko, subprocess, sys

# ── الخطوة 1: push للـ git محلياً ───────────────────────────────────────────
print("📤 pushing to git...")
result = subprocess.run(
    ["git", "push", "origin", "master"],
    cwd=r"D:\seesaw-main\seesaw-main",
    capture_output=True, text=True
)
if result.returncode != 0:
    print("git push failed:", result.stderr)
    sys.exit(1)
print("✅ git push OK")

# ── الخطوة 2: على VPS — pull + restart ──────────────────────────────────────
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

cmd = "cd /var/www/sillar && git pull origin master && pm2 restart sillar-local && echo DONE"
_, out, err = c.exec_command(cmd, timeout=60)
output = out.read().decode()
print(output)
if "DONE" in output:
    print("✅ deployed successfully")
else:
    print("⚠️", err.read().decode()[:300])

c.close()
