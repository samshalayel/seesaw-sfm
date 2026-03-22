import { getClickUpToken } from './vaultStore';

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

async function getHeaders(roomId?: string) {
  const vaultToken = await getClickUpToken(roomId);
  const token = vaultToken || process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("ClickUp not connected. Add your token in the vault settings.");
  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
}

async function clickupFetch(path: string, roomId?: string) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, { headers: await getHeaders(roomId) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function clickupPut(path: string, body: any, roomId?: string) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    method: "PUT",
    headers: await getHeaders(roomId),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function clickupPost(path: string, body: any, roomId?: string) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    method: "POST",
    headers: await getHeaders(roomId),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getTeams(roomId?: string) {
  const data = await clickupFetch("/team", roomId);
  return data.teams?.map((t: any) => ({ id: t.id, name: t.name })) || [];
}

export async function getSpaces(teamId: string, roomId?: string) {
  const data = await clickupFetch(`/team/${teamId}/space?archived=false`, roomId);
  return data.spaces?.map((s: any) => ({ id: s.id, name: s.name })) || [];
}

export async function getFolders(spaceId: string, roomId?: string) {
  const data = await clickupFetch(`/space/${spaceId}/folder?archived=false`, roomId);
  return data.folders?.map((f: any) => ({ id: f.id, name: f.name })) || [];
}

export async function getLists(folderId: string, roomId?: string) {
  const data = await clickupFetch(`/folder/${folderId}/list?archived=false`, roomId);
  return data.lists?.map((l: any) => ({ id: l.id, name: l.name, taskCount: l.task_count })) || [];
}

export async function getFolderlessLists(spaceId: string, roomId?: string) {
  const data = await clickupFetch(`/space/${spaceId}/list?archived=false`, roomId);
  return data.lists?.map((l: any) => ({ id: l.id, name: l.name, taskCount: l.task_count })) || [];
}

export async function getTasks(listId: string, roomId?: string) {
  const data = await clickupFetch(`/list/${listId}/task?archived=false&include_closed=true&subtasks=true`, roomId);
  return data.tasks?.map((t: any) => ({
    id: t.id,
    name: t.name,
    status: t.status?.status,
    priority: t.priority?.priority,
    assignees: t.assignees?.map((a: any) => a.username) || [],
    dueDate: t.due_date ? new Date(parseInt(t.due_date)).toISOString().split("T")[0] : null,
    tags: t.tags?.map((tag: any) => tag.name) || [],
  })) || [];
}

export async function getTask(taskId: string, roomId?: string) {
  const data = await clickupFetch(`/task/${taskId}`, roomId);
  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    status: data.status?.status,
    priority: data.priority?.priority,
    assignees: data.assignees?.map((a: any) => a.username) || [],
    dueDate: data.due_date ? new Date(parseInt(data.due_date)).toISOString().split("T")[0] : null,
    tags: data.tags?.map((tag: any) => tag.name) || [],
    list: data.list?.name,
    folder: data.folder?.name,
    space: data.space?.name,
  };
}

export async function getWorkspaceMembers(roomId?: string) {
  const teams = await getTeams(roomId);
  if (!teams.length) return [];
  const data = await clickupFetch(`/team/${teams[0].id}`, roomId);
  const team = data.team;
  return team?.members?.map((m: any) => ({
    id: m.user?.id,
    username: m.user?.username,
    email: m.user?.email,
    name: m.user?.username,
  })) || [];
}

export async function updateTask(taskId: string, updates: {
  name?: string;
  description?: string;
  status?: string;
  priority?: number;
  due_date?: number;
  assignees_add?: number[];
  assignees_rem?: number[];
}, roomId?: string) {
  const body: any = {};
  if (updates.name) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.status) body.status = updates.status;
  if (updates.priority !== undefined) body.priority = updates.priority;
  if (updates.due_date) body.due_date = updates.due_date;
  if (updates.assignees_add || updates.assignees_rem) {
    body.assignees = {};
    if (updates.assignees_add) body.assignees.add = updates.assignees_add;
    if (updates.assignees_rem) body.assignees.rem = updates.assignees_rem;
  }
  const result = await clickupPut(`/task/${taskId}`, body, roomId);
  return {
    id: result.id,
    name: result.name,
    status: result.status?.status,
    assignees: result.assignees?.map((a: any) => ({ id: a.id, username: a.username })) || [],
  };
}

export async function createTask(listId: string, taskData: {
  name: string;
  description?: string;
  status?: string;
  priority?: number;
  due_date?: number;
  assignees?: number[];
}, roomId?: string) {
  const result = await clickupPost(`/list/${listId}/task`, taskData, roomId);
  return {
    id: result.id,
    name: result.name,
    status: result.status?.status,
    url: result.url,
  };
}

export async function searchTasksByName(query: string, roomId?: string): Promise<any[]> {
  const teams = await getTeams(roomId);
  if (!teams.length) return [];

  const results: any[] = [];
  const lowerQuery = query.toLowerCase();

  for (const team of teams) {
    const spaces = await getSpaces(team.id, roomId);
    for (const space of spaces) {
      const folders = await getFolders(space.id, roomId);
      for (const folder of folders) {
        const lists = await getLists(folder.id, roomId);
        for (const list of lists) {
          const tasks = await getTasks(list.id, roomId);
          for (const task of tasks) {
            if (task.name.toLowerCase().includes(lowerQuery)) {
              results.push({ ...task, list: list.name, folder: folder.name, space: space.name });
            }
          }
        }
      }
      const folderlessLists = await getFolderlessLists(space.id, roomId);
      for (const list of folderlessLists) {
        const tasks = await getTasks(list.id, roomId);
        for (const task of tasks) {
          if (task.name.toLowerCase().includes(lowerQuery)) {
            results.push({ ...task, list: list.name, folder: "(no folder)", space: space.name });
          }
        }
      }
    }
  }
  return results;
}

export async function getFullWorkspaceStructure(roomId?: string): Promise<string> {
  const teams = await getTeams(roomId);
  if (!teams.length) return "No workspaces found.";

  let structure = "";
  for (const team of teams) {
    structure += `Workspace: ${team.name} (ID: ${team.id})\n`;
    const spaces = await getSpaces(team.id, roomId);
    for (const space of spaces) {
      structure += `  Space: ${space.name} (ID: ${space.id})\n`;
      const folders = await getFolders(space.id, roomId);
      for (const folder of folders) {
        structure += `    Folder: ${folder.name} (ID: ${folder.id})\n`;
        const lists = await getLists(folder.id, roomId);
        for (const list of lists) {
          structure += `      List: ${list.name} (ID: ${list.id})\n`;
        }
      }
      const folderlessLists = await getFolderlessLists(space.id, roomId);
      for (const list of folderlessLists) {
        structure += `    List (no folder): ${list.name} (ID: ${list.id})\n`;
      }
    }
  }
  return structure;
}

export async function getAllTasksRaw(roomId?: string): Promise<any[]> {
  const allTasks: any[] = [];
  try {
    const teams = await getTeams(roomId);
    for (const team of teams) {
      const spaces = await getSpaces(team.id, roomId);
      for (const space of spaces) {
        const folders = await getFolders(space.id, roomId);
        for (const folder of folders) {
          const lists = await getLists(folder.id, roomId);
          for (const list of lists) {
            const data = await clickupFetch(`/list/${list.id}/task?archived=false&include_closed=false&subtasks=true`, roomId);
            const tasks = data.tasks || [];
            for (const t of tasks) {
              allTasks.push({
                id: t.id,
                name: t.name,
                description: t.description || "",
                status: t.status?.status,
                priority: t.priority?.priority,
                assignees: t.assignees?.map((a: any) => ({ id: a.id, username: a.username, email: a.email })) || [],
                dueDate: t.due_date ? new Date(parseInt(t.due_date)).toISOString().split("T")[0] : null,
                tags: t.tags?.map((tag: any) => tag.name) || [],
                list: list.name,
                folder: folder.name,
                space: space.name,
              });
            }
          }
        }
        const folderlessLists = await getFolderlessLists(space.id, roomId);
        for (const list of folderlessLists) {
          const data = await clickupFetch(`/list/${list.id}/task?archived=false&include_closed=false&subtasks=true`, roomId);
          const tasks = data.tasks || [];
          for (const t of tasks) {
            allTasks.push({
              id: t.id,
              name: t.name,
              description: t.description || "",
              status: t.status?.status,
              priority: t.priority?.priority,
              assignees: t.assignees?.map((a: any) => ({ id: a.id, username: a.username, email: a.email })) || [],
              dueDate: t.due_date ? new Date(parseInt(t.due_date)).toISOString().split("T")[0] : null,
              tags: t.tags?.map((tag: any) => tag.name) || [],
              list: list.name,
              folder: "(no folder)",
              space: space.name,
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[getAllTasksRaw] Error:", err.message);
  }
  return allTasks;
}

export async function getClickUpSummary(roomId?: string): Promise<string> {
  try {
    const teams = await getTeams(roomId);
    if (!teams.length) return "No ClickUp workspaces found.";

    let summary = "";
    for (const team of teams) {
      summary += `Workspace: ${team.name}\n`;
      const spaces = await getSpaces(team.id, roomId);
      for (const space of spaces) {
        summary += `  Space: ${space.name}\n`;
        const folders = await getFolders(space.id, roomId);
        for (const folder of folders) {
          summary += `    Folder: ${folder.name}\n`;
          const lists = await getLists(folder.id, roomId);
          for (const list of lists) {
            const tasks = await getTasks(list.id, roomId);
            summary += `      List: ${list.name} (${tasks.length} tasks)\n`;
            for (const task of tasks) {
              summary += `        - [${task.status}] ${task.name}${task.priority ? ` (${task.priority})` : ""}${task.assignees.length ? ` → ${task.assignees.join(", ")}` : ""}${task.dueDate ? ` (due: ${task.dueDate})` : ""}\n`;
            }
          }
        }
        const folderlessLists = await getFolderlessLists(space.id, roomId);
        for (const list of folderlessLists) {
          const tasks = await getTasks(list.id, roomId);
          summary += `    List: ${list.name} (${tasks.length} tasks)\n`;
          for (const task of tasks) {
            summary += `      - [${task.status}] ${task.name}${task.priority ? ` (${task.priority})` : ""}${task.assignees.length ? ` → ${task.assignees.join(", ")}` : ""}${task.dueDate ? ` (due: ${task.dueDate})` : ""}\n`;
          }
        }
      }
    }
    return summary || "No data found in ClickUp.";
  } catch (err: any) {
    return `Error fetching ClickUp data: ${err.message}`;
  }
}
