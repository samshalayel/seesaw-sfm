import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateVaults() {
  const client = await pool.connect();
  const vaultsDir = path.join(process.cwd(), ".vaults");

  if (!fs.existsSync(vaultsDir)) {
    console.log("No .vaults directory found");
    await pool.end();
    return;
  }

  const files = fs.readdirSync(vaultsDir).filter(f => f.endsWith(".json"));
  console.log(`Found ${files.length} vault files`);

  for (const file of files) {
    const roomId = file.replace(".json", "");
    try {
      const data = JSON.parse(fs.readFileSync(path.join(vaultsDir, file), "utf-8"));

      await client.query(`
        UPDATE rooms SET
          company_name      = $2,  company_logo      = $3,
          main_door_code    = $4,  manager_door_code = $5,
          github_token      = $6,  github_owner      = $7,  github_repo      = $8,
          clickup_token     = $9,  clickup_list_id   = $10, clickup_assignee = $11,
          default_model     = $12, system_prompt     = $13
        WHERE room_id = $1
      `, [
        roomId,
        data.company?.name      || "",
        data.company?.logo      || "",
        data.doors?.mainCode    || "1977",
        data.doors?.managerCode || "0000",
        data.github?.token      || "",
        data.github?.owner      || "",
        data.github?.repo       || "",
        data.clickup?.token     || "",
        data.clickup?.listId    || "",
        data.clickup?.assignee  || "",
        data.defaultModel       || "",
        data.systemPrompt       || "",
      ]);

      // models
      if (Array.isArray(data.models) && data.models.length > 0) {
        await client.query("DELETE FROM room_models WHERE room_id = $1", [roomId]);
        for (let i = 0; i < data.models.length; i++) {
          const m = data.models[i];
          await client.query(`
            INSERT INTO room_models (room_id, name, api_key, model_id, system_prompt, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [roomId, m.name || "", m.apiKey || "", m.modelId || "", m.systemPrompt || "", i]);
        }
        console.log(`✓ ${roomId} — ${data.models.length} models`);
      } else {
        console.log(`✓ ${roomId} — no models`);
      }
    } catch (e) {
      console.error(`✗ ${roomId}: ${e.message}`);
    }
  }

  client.release();
  await pool.end();
  console.log("Done!");
}

migrateVaults();
