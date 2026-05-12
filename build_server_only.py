import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('144.172.102.6', username='root', password='21vU9xtxSVyFt3', timeout=60)

# Write a minimal build script that only builds the server (no vite)
build_script = r"""
import { build as esbuild } from "esbuild";
import { readFile } from "fs/promises";

const allowlist = [
  "@google/generative-ai","axios","connect-pg-simple","cors","date-fns",
  "drizzle-orm","drizzle-zod","express","express-rate-limit","express-session",
  "jsonwebtoken","memorystore","multer","nanoid","nodemailer","openai",
  "passport","passport-local","pg","stripe","uuid","ws","xlsx","zod","zod-validation-error",
];

async function buildServer() {
  console.log("building server only...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: externals,
    logLevel: "info",
  });
  console.log("Server built successfully!");
}

buildServer().catch((err) => { console.error(err); process.exit(1); });
"""

# Write the script to VPS
_, out, _ = c.exec_command(f'cat > /var/www/sillar/script/build-server-only.ts << \'EOFILE\'\n{build_script}\nEOFILE', timeout=10)
print("Script written:", out.read().decode())

# Run it
print("Building server...")
_, out2, err2 = c.exec_command('cd /var/www/sillar && npx tsx script/build-server-only.ts 2>&1', timeout=120)
result = out2.read().decode()
print(result[-3000:] if len(result) > 3000 else result)

c.close()
