import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_room_id_unique') THEN ALTER TABLE users ADD CONSTRAINT users_room_id_unique UNIQUE (room_id); END IF; END $$;`);
    await client.query(`CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL UNIQUE REFERENCES users(room_id), company_name TEXT NOT NULL DEFAULT '', company_logo TEXT NOT NULL DEFAULT '', main_door_code TEXT NOT NULL DEFAULT '1977', manager_door_code TEXT NOT NULL DEFAULT '0000', github_token TEXT NOT NULL DEFAULT '', github_owner TEXT NOT NULL DEFAULT '', github_repo TEXT NOT NULL DEFAULT '', clickup_token TEXT NOT NULL DEFAULT '', clickup_list_id TEXT NOT NULL DEFAULT '', clickup_assignee TEXT NOT NULL DEFAULT '', default_model TEXT NOT NULL DEFAULT '', system_prompt TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT NOW());`);
    await client.query(`CREATE TABLE IF NOT EXISTS room_models (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(room_id), name TEXT NOT NULL, api_key TEXT NOT NULL DEFAULT '', model_id TEXT NOT NULL DEFAULT '', system_prompt TEXT NOT NULL DEFAULT '', order_index INTEGER NOT NULL DEFAULT 0);`);
    await client.query(`CREATE TABLE IF NOT EXISTS room_playlist (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(room_id), video_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', order_index INTEGER NOT NULL DEFAULT 0);`);
    const users = await client.query("SELECT room_id, manager_code FROM users");
    for (const u of users.rows) {
      await client.query(`INSERT INTO rooms (room_id, manager_door_code) VALUES ($1, $2) ON CONFLICT (room_id) DO NOTHING`, [u.room_id, u.manager_code || "0000"]);
    }
    const has = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='manager_code'`);
    if (has.rows.length > 0) await client.query("ALTER TABLE users DROP COLUMN manager_code");
    await client.query("COMMIT");
    console.log("Migration complete!");
  } catch(e) { await client.query("ROLLBACK"); console.error(e.message); process.exit(1); }
  finally { client.release(); await pool.end(); }
}
migrate();
