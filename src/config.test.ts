import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.PHABRICATOR_URL;
    delete process.env.PHABRICATOR_API_TOKEN;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('should load config from environment variables', () => {
    process.env.PHABRICATOR_URL = 'https://phabricator.example.com';
    process.env.PHABRICATOR_API_TOKEN = 'api-test-token';

    const config = loadConfig();

    assert.strictEqual(config.phabricatorUrl, 'https://phabricator.example.com');
    assert.strictEqual(config.apiToken, 'api-test-token');
  });

  it('should strip trailing slash from URL', () => {
    process.env.PHABRICATOR_URL = 'https://phabricator.example.com/';
    process.env.PHABRICATOR_API_TOKEN = 'api-test-token';

    const config = loadConfig();

    assert.strictEqual(config.phabricatorUrl, 'https://phabricator.example.com');
  });

  it('should throw error for invalid URL', () => {
    process.env.PHABRICATOR_URL = 'not-a-valid-url';
    process.env.PHABRICATOR_API_TOKEN = 'api-test-token';

    assert.throws(() => loadConfig(), /Invalid url/);
  });

  it('should prefer env vars over arcrc', () => {
    // Even if arcrc exists, env vars should take precedence
    process.env.PHABRICATOR_URL = 'https://custom.example.com';
    process.env.PHABRICATOR_API_TOKEN = 'custom-token';

    const config = loadConfig();

    assert.strictEqual(config.phabricatorUrl, 'https://custom.example.com');
    assert.strictEqual(config.apiToken, 'custom-token');
  });
});
