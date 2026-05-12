import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=30)

# Backup current config
_, out, _ = c.exec_command('cp /etc/nginx/sites-available/seesaw /etc/nginx/sites-available/seesaw.bak', timeout=10)
print("Backup:", out.read().decode())

# Write fixed nginx config
nginx_config = r"""server {
  server_name sillar.uk www.sillar.uk;
  client_max_body_size 50m;

  # WebSocket dedicated location
  location /ws/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Sec-WebSocket-Extensions "";
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_buffering off;
    proxy_request_buffering off;
    gzip off;
  }

  location ~* \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|glb|mp3|wav|pdf)$ {
    root /var/www/sillar/dist/public;
    try_files $uri @nodejs;
    expires 7d;
    add_header Cache-Control "public";
  }

  location @nodejs {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ~ ^/api/(data|facilities|forecast|polygons|stock)(/|$) {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  listen 443 ssl;
  ssl_certificate /etc/letsencrypt/live/sillar.uk/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/sillar.uk/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = www.sillar.uk) { return 301 https://$host$request_uri; }
    if ($host = sillar.uk)     { return 301 https://$host$request_uri; }
    listen 80;
    server_name sillar.uk www.sillar.uk;
    return 404;
}
"""

# Write the config
_, out2, err2 = c.exec_command(f"cat > /etc/nginx/sites-available/seesaw << 'NGINX_EOF'\n{nginx_config}\nNGINX_EOF", timeout=10)
print("Write result:", out2.read().decode(), err2.read().decode()[:100])

# Test nginx config
_, out3, err3 = c.exec_command('nginx -t 2>&1', timeout=10)
print("nginx -t:", out3.read().decode())

# Reload nginx
_, out4, _ = c.exec_command('nginx -s reload 2>&1', timeout=10)
print("nginx reload:", out4.read().decode())

# Verify the fix
_, out5, _ = c.exec_command(r"grep 'Upgrade\|http_upgrade' /etc/nginx/sites-available/seesaw | head -5", timeout=10)
print("Verify:", out5.read().decode())

c.close()
