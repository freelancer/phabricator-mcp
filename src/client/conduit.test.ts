import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ConduitClient, ConduitError } from './conduit.js';

describe('ConduitClient', () => {
  const mockConfig = {
    phabricatorUrl: 'https://phabricator.example.com',
    apiToken: 'api-test-token',
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should construct correct API URL', async () => {
    let capturedUrl: string | undefined;
    global.fetch = mock.fn(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ result: {}, error_code: null, error_info: null }));
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    await client.call('user.whoami');

    assert.strictEqual(capturedUrl, 'https://phabricator.example.com/api/user.whoami');
  });

  it('should include API token in request body', async () => {
    let capturedBody: string | undefined;
    global.fetch = mock.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ result: {}, error_code: null, error_info: null }));
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    await client.call('user.whoami');

    assert.ok(capturedBody);
    const params = new URLSearchParams(capturedBody);
    const paramsJson = JSON.parse(params.get('params')!);
    assert.strictEqual(paramsJson.__conduit__.token, 'api-test-token');
  });

  it('should pass parameters to the API', async () => {
    let capturedBody: string | undefined;
    global.fetch = mock.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ result: {}, error_code: null, error_info: null }));
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    await client.call('maniphest.search', { queryKey: 'assigned', limit: 10 });

    const params = new URLSearchParams(capturedBody!);
    const paramsJson = JSON.parse(params.get('params')!);
    assert.strictEqual(paramsJson.queryKey, 'assigned');
    assert.strictEqual(paramsJson.limit, 10);
  });

  it('should return result on success', async () => {
    const expectedResult = { userName: 'testuser', realName: 'Test User' };
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ result: expectedResult, error_code: null, error_info: null }));
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    const result = await client.call('user.whoami');

    assert.deepStrictEqual(result, expectedResult);
  });

  it('should throw ConduitError on API error', async () => {
    global.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({
        result: null,
        error_code: 'ERR-CONDUIT-CORE',
        error_info: 'Invalid token',
      }));
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    await assert.rejects(
      () => client.call('user.whoami'),
      (err: Error) => {
        assert.ok(err instanceof ConduitError);
        assert.strictEqual((err as ConduitError).code, 'ERR-CONDUIT-CORE');
        assert.strictEqual(err.message, 'Invalid token');
        return true;
      },
    );
  });

  it('should throw ConduitError on HTTP error', async () => {
    global.fetch = mock.fn(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }) as typeof fetch;

    const client = new ConduitClient(mockConfig);
    await assert.rejects(
      () => client.call('user.whoami'),
      (err: Error) => {
        assert.ok(err instanceof ConduitError);
        assert.strictEqual((err as ConduitError).code, 'HTTP_ERROR');
        assert.ok(err.message.includes('404'));
        return true;
      },
    );
  });
});

describe('ConduitError', () => {
  it('should have correct name and properties', () => {
    const error = new ConduitError('TEST_CODE', 'Test message');
    assert.strictEqual(error.name, 'ConduitError');
    assert.strictEqual(error.code, 'TEST_CODE');
    assert.strictEqual(error.message, 'Test message');
  });
});
