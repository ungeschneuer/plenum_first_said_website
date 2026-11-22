// Starts the workflow .github/workflows/share.yml and reads its runs through the GitHub API. The admin view keeps the
// access token only in the browser that entered it.
import { SOURCE_REPOSITORY } from '../siteConfig.js';

export const SHARE_WORKFLOW = 'share.yml';
const REPOSITORY = SOURCE_REPOSITORY.replace(/^https:\/\/github\.com\//, '');
const API = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${SHARE_WORKFLOW}`;

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function failure(response) {
  let message = '';
  try {
    message = (await response.json()).message ?? '';
  } catch {
    // no JSON body
  }
  if (response.status === 401) return new Error('Der Token ist ungültig oder abgelaufen.');
  if (response.status === 403 || response.status === 404) {
    return new Error(`Der Token darf diesen Workflow nicht starten (HTTP ${response.status}). Er braucht für dieses ` +
      'Repository die Berechtigung „Actions: Read and write“.');
  }
  return new Error(`GitHub antwortet mit HTTP ${response.status}${message ? `: ${message}` : ''}`);
}

export async function startShareRun(token, request, dryRun, request_ = fetch) {
  const response = await request_(`${API}/dispatches`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ ref: 'main', inputs: { request: JSON.stringify(request), dry_run: dryRun ? 'true' : 'false' } }),
  });
  if (!response.ok) throw await failure(response);
}

export async function listShareRuns(token, request_ = fetch) {
  const response = await request_(`${API}/runs?per_page=10`, { headers: headers(token) });
  if (!response.ok) throw await failure(response);
  const { workflow_runs: runs } = await response.json();
  return runs.map((run) => ({
    id: run.id,
    title: run.display_title,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    url: run.html_url,
  }));
}
