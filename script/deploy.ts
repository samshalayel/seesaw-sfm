/**
 * deploy.ts — رفع التحديثات على VPS
 * تشغيل: npx tsx script/deploy.ts
 */

import { Client } from "ssh2";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const VPS = {
  host:     "144.172.102.6",
  port:     22,
  username: "root",
  password: "21vU9xtxSVyFt3",
};

const REMOTE_DIR = "/var/www/sillar";
const APP_NAME   = "sillar";

function log(msg: string)  { console.log(`\x1b[36m[deploy]\x1b[0m ${msg}`); }
function ok(msg: string)   { console.log(`\x1b[32m[✓]\x1b[0m ${msg}`); }
function fail(msg: string) { console.error(`\x1b[31m[✗]\x1b[0m ${msg}`); }

function sshExec(conn: Client, cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (e, stream) => {
      if (e) return reject(e);
      stream.on("data", (d: Buffer) => process.stdout.write(d));
      stream.stderr.on("data", (d: Buffer) => process.stderr.write(d));
      stream.on("close", (code: number) =>
        code === 0 ? resolve() : reject(new Error(`exit ${code}`))
      );
    });
  });
}

function getSftp(conn: Client): Promise<any> {
  return new Promise((resolve, reject) =>
    conn.sftp((e, s) => e ? reject(e) : resolve(s))
  );
}

function sftpMkdir(sftp: any, dir: string): Promise<void> {
  return new Promise((res) => sftp.mkdir(dir, () => res()));
}

function sftpPut(sftp: any, local: string, remote: string): Promise<void> {
  return new Promise((res, rej) =>
    sftp.fastPut(local, remote, (e: any) => e ? rej(e) : res())
  );
}

async function uploadDir(sftp: any, localDir: string, remoteDir: string) {
  await sftpMkdir(sftp, remoteDir);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    const lp = path.join(localDir, entry.name);
    const rp = `${remoteDir}/${entry.name}`;
    if (entry.isDirectory()) await uploadDir(sftp, lp, rp);
    else                     await sftpPut(sftp, lp, rp);
  }
}

async function main() {
  // 1. بناء
  log("جاري البناء...");
  execSync("npm run build", { stdio: "inherit" });
  ok("البناء اكتمل");

  // 2. اتصال
  log(`الاتصال بـ ${VPS.host}...`);
  const conn = new Client();
  await new Promise<void>((res, rej) => {
    conn.on("ready", res).on("error", rej).connect(VPS);
  });
  ok("متصل بالـ VPS");

  // 3. رفع dist/
  log("رفع dist/...");
  const sftp = await getSftp(conn);
  await sshExec(conn, `rm -rf ${REMOTE_DIR}/dist`);
  await uploadDir(sftp, path.resolve("dist"), `${REMOTE_DIR}/dist`);
  ok("dist/ تم رفعه");

  // 4. إعادة تشغيل التطبيق
  log("إعادة التشغيل...");
  await sshExec(conn,
    `cd ${REMOTE_DIR} && pm2 restart ${APP_NAME} || pm2 start dist/index.cjs --name ${APP_NAME}`
  );
  ok("التطبيق أُعيد تشغيله");

  conn.end();
  console.log(`
\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m
\x1b[32m✓ التحديث وصل!\x1b[0m
\x1b[36m🌐\x1b[0m http://${VPS.host}:5000
\x1b[36m📋 لوجات:\x1b[0m ssh root@${VPS.host} "pm2 logs ${APP_NAME}"
\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m
  `);
}

main().catch((e) => { fail(e.message); process.exit(1); });
