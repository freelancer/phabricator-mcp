import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const configSchema = z.object({
  phabricatorUrl: z.string().url().transform(url => url.replace(/\/$/, '')),
  apiToken: z.string().min(1),
});

export type Config = z.infer<typeof configSchema>;

interface ArcConfig {
  hosts: Record<string, { token: string }>;
}

function loadFromArcrc(): { url: string; token: string } | null {
  try {
    const arcrcPath = join(homedir(), '.arcrc');
    const content = readFileSync(arcrcPath, 'utf-8');
    const arcConfig = JSON.parse(content) as ArcConfig;

    const hosts = Object.entries(arcConfig.hosts || {});
    if (hosts.length === 0) {
      return null;
    }

    // Use the first host found
    const [hostUrl, hostConfig] = hosts[0]!;

    // Extract base URL (remove /api/ suffix if present)
    const url = hostUrl.replace(/\/api\/?$/, '');

    return {
      url,
      token: hostConfig.token,
    };
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  // Try environment variables first
  let url = process.env.PHABRICATOR_URL;
  let token = process.env.PHABRICATOR_API_TOKEN;

  // Fall back to ~/.arcrc if env vars not set
  if (!url || !token) {
    const arcConfig = loadFromArcrc();
    if (arcConfig) {
      url = url || arcConfig.url;
      token = token || arcConfig.token;
    }
  }

  if (!url) {
    throw new Error('PHABRICATOR_URL not set and ~/.arcrc not found or invalid');
  }
  if (!token) {
    throw new Error('PHABRICATOR_API_TOKEN not set and ~/.arcrc not found or invalid');
  }

  return configSchema.parse({
    phabricatorUrl: url,
    apiToken: token,
  });
}
