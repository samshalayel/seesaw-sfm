// GitHub integration using Replit connector + vault fallback
import { Octokit } from '@octokit/rest';
import { getGitHubToken } from './vaultStore';

let connectionSettings: any;

async function getAccessToken(roomId?: string) {
  const vaultToken = await getGitHubToken(roomId);
  if (vaultToken) {
    return vaultToken;
  }

  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now() + 60000) {
    return connectionSettings.settings.access_token;
  }
  connectionSettings = null;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('GitHub not connected. Add your token in the vault settings.');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected. Add your token in the vault settings.');
  }
  return accessToken;
}

async function getClient(roomId?: string) {
  const accessToken = await getAccessToken(roomId);
  return new Octokit({ auth: accessToken });
}

export async function getRepos(roomId?: string) {
  try {
    const octokit = await getClient(roomId);
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 20,
    });
    return data.map((r: any) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      language: r.language,
      updatedAt: r.updated_at,
      url: r.html_url,
      isPrivate: r.private,
    }));
  } catch (err: any) {
    throw new Error(`GitHub repos error: ${err.message}`);
  }
}

export async function getRepoContents(owner: string, repo: string, path: string = "", roomId?: string) {
  try {
    const octokit = await getClient(roomId);
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        type: item.type,
        path: item.path,
        size: item.size,
      }));
    }
    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { name: data.name, path: data.path, content: content.substring(0, 3000) };
    }
    return data;
  } catch (err: any) {
    throw new Error(`GitHub content error: ${err.message}`);
  }
}

export async function getAuthenticatedUser(roomId?: string) {
  try {
    const octokit = await getClient(roomId);
    const { data } = await octokit.users.getAuthenticated();
    return data.login;
  } catch (err: any) {
    throw new Error(`GitHub user error: ${err.message}`);
  }
}

export async function createOrUpdateFile(owner: string, repo: string, path: string, content: string, commitMessage: string, roomId?: string, isBase64 = false) {
  try {
    const octokit = await getClient(roomId);
    const contentBase64 = isBase64 ? content : Buffer.from(content).toString('base64');

    let sha: string | undefined;
    try {
      const { data: existing } = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(existing) && 'sha' in existing) {
        sha = existing.sha;
      }
    } catch (_e) {
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: commitMessage,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    });

    return {
      success: true,
      path: data.content?.path,
      sha: data.content?.sha,
      commitSha: data.commit?.sha,
      commitUrl: data.commit?.html_url,
    };
  } catch (err: any) {
    throw new Error(`GitHub create file error: ${err.message}`);
  }
}

export async function getCommitChecks(owner: string, repo: string, ref: string) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.checks.listForRef({ owner, repo, ref });
    return data.check_runs.map((run: any) => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      output: run.output?.summary || run.output?.text || null,
      detailsUrl: run.details_url,
      htmlUrl: run.html_url,
    }));
  } catch (err: any) {
    throw new Error(`GitHub checks error: ${err.message}`);
  }
}

export async function getWorkflowRuns(owner: string, repo: string) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 10,
    });
    return data.workflow_runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha?.substring(0, 7),
      htmlUrl: run.html_url,
      createdAt: run.created_at,
    }));
  } catch (err: any) {
    throw new Error(`GitHub workflow runs error: ${err.message}`);
  }
}

export async function getWorkflowRunLogs(owner: string, repo: string, runId: number) {
  try {
    const octokit = await getClient();
    const { data } = await octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data.jobs.map((job: any) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      steps: job.steps?.map((s: any) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
      })),
    }));
  } catch (err: any) {
    throw new Error(`GitHub workflow logs error: ${err.message}`);
  }
}

// ── قراءة أحدث ملف مرحلة من GitHub لمشروع معين ────────────────────────────────
export async function getLatestStageFile(
  owner: string,
  repo: string,
  projectKey: string,
  stage: string,  // "PD" | "S0" | ...
  roomId?: string,
): Promise<{ name: string; content: string } | null> {
  try {
    const octokit = await getClient(roomId);
    const { data } = await octokit.repos.getContent({ owner, repo, path: "" });
    if (!Array.isArray(data)) return null;

    const prefix = `${projectKey.toUpperCase()}_${stage.toUpperCase()}_`;
    const matches = (data as any[])
      .filter(f => f.type === "file" && f.name.startsWith(prefix) && f.name.endsWith(".json"))
      .sort((a, b) => b.name.localeCompare(a.name)); // أحدث أولاً

    if (matches.length === 0) return null;

    const { data: fileData } = await octokit.repos.getContent({ owner, repo, path: matches[0].name });
    if ('content' in fileData && fileData.content) {
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      return { name: matches[0].name, content };
    }
    return null;
  } catch (_e) {
    return null;
  }
}

export async function getGitHubSummary(): Promise<string> {
  try {
    const repos = await getRepos();
    if (!repos.length) return "No GitHub repositories found.";

    let summary = "GitHub Repositories:\n";
    for (const repo of repos) {
      summary += `- ${repo.fullName}${repo.language ? ` (${repo.language})` : ""}${repo.isPrivate ? " [Private]" : " [Public]"}: ${repo.description || "No description"}\n`;
    }
    return summary;
  } catch (err: any) {
    return `Error fetching GitHub data: ${err.message}`;
  }
}
