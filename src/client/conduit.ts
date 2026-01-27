import type { Config } from '../config.js';

export class ConduitError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConduitError';
  }
}

interface ConduitResponse<T> {
  result: T;
  error_code: string | null;
  error_info: string | null;
}

export class ConduitClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(config: Config) {
    this.baseUrl = config.phabricatorUrl;
    this.apiToken = config.apiToken;
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.baseUrl}/api/${method}`;

    const body = new URLSearchParams();
    body.append('params', JSON.stringify({
      ...params,
      '__conduit__': { token: this.apiToken },
    }));
    body.append('output', 'json');
    body.append('__conduit__', 'true');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new ConduitError(
        'HTTP_ERROR',
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json() as ConduitResponse<T>;

    if (data.error_code) {
      throw new ConduitError(
        data.error_code,
        data.error_info || 'Unknown error',
      );
    }

    return data.result;
  }
}
