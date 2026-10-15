# Contributing

Every tool is a thin wrapper over a Conduit method, so most bugs are a mismatch with what a real Phabricator accepts: a method that does not exist on the instance, a transaction type it does not know, or a value in the wrong shape. Type checks and unit tests cannot see those. Check each change against a Phabricator before you open a pull request, as below.

## Unit tests

```bash
npm run typecheck
npm test
```

To test a tool's handler, register its tools on an `McpServer`, connect a `Client` over `InMemoryTransport`, and pass a fake `ConduitClient` whose `call()` records the method and parameters it receives. Assert on those calls: they are what Phabricator would see. `src/tools/conpherence.test.ts` does this.

## Checking a change against Phabricator

All of these are safe to run against a shared instance; none of them writes anything.

- **The method exists.** `conduit.query` returns every method the instance offers, with its parameters. An application can be uninstalled, a method can exist in Phorge but not Phabricator or the other way round, and a method name can look right without existing anywhere. List a new tool's methods in `src/tools/availability.ts`: the server hides tools whose methods an instance lacks.
- **Parameter names match.** Compare what the handler sends with the method's parameters in `conduit.query`.
- **Transaction types are valid.** Call the `*.edit` method with one transaction of a made-up type. Phabricator rejects it before applying anything and lists every valid type in the error.
- **Reads return what you expect.** Call each read tool you changed with inputs that should return data. An empty `data` list shows the call parses, not that a constraint does anything.

Test write tools on a local Phabricator, not a shared one.

## A local Phabricator

A throwaway instance in Docker is enough to call every tool, including the writes. Use the Phabricator (or Phorge) and Arcanist commits you deploy, and the PHP version you run them on, and say in the pull request which you tested: the two forks differ.

- **Services.** A MySQL server (5.7 works), then `bin/storage upgrade --force`, then the web server and the daemons. `php -S` with a small router that serves files from `webroot/` and sends everything else to `webroot/index.php` is enough for the web server.
- **Domain.** Phabricator refuses hostnames without a dot. A `*.localhost` name such as `phabricator.localhost` resolves to loopback on most systems without editing `/etc/hosts`. Set `phabricator.base-uri` to match, including the port.
- **Daemons.** `bin/phd start` needs `ps`, which slim PHP images lack (install `procps`). Feed stories, repository imports and Harbormaster builds all wait on the daemons.
- **Users and tokens.** Create users and Conduit tokens with a short PHP script that loads `scripts/init/init-script.php`, then uses `PhabricatorUserEditor` and `PhabricatorConduitToken::initializeNewToken()`. Make two users: by default you cannot accept your own revision.
- **Repositories.** Create a hosted repository with `phabricator_repository_edit`. Once the daemons have initialised it, push to its path on disk with hooks turned off (`git push --receive-pack='git -c core.hooksPath=/nonexistent receive-pack' <path> ...`), then run `bin/repository update` on it.
- **Fixtures Conduit cannot make**, such as spaces or a workboard's columns, can come from the same kind of PHP script.
- **Config files.** On Docker Desktop, a file bind-mounted on its own can go stale or come through truncated after you edit it on the host. Restart the containers after changing one.

Point the server at it with `PHABRICATOR_URL` and `PHABRICATOR_API_TOKEN`, call each tool through an MCP client over stdio, and read each write back with a direct Conduit call rather than through the tool under test.

## Conduit behaviour worth knowing

- Some IDs do not fit in a JavaScript number. Feed `chronologicalKey`s are above 2^53, so take them as strings, never `z.coerce.number()`.
- Check value shapes against a real call, not only the method's documentation. `maniphest.edit` documents `column` as accepting `{"columnPHID": ...}` objects, but only accepts a list of PHID strings.
- Not every Conduit edit works everywhere. Creating a project milestone through `project.edit` crashes Phabricator; Phorge has fixed it.
- Search results do not always include every field the edit method sets. `phame.post.search` has no `visibility`, for instance, so check `datePublished` instead.
- Empty results are not always meaningless. A search with no matches still returns `data: []`, and `jsonResult()` keeps it.

## Pull requests

Write the description as a summary of what changed and why, then a test plan listing what you ran and what you saw. Update `README.md` and `docs/index.html` when tools change; `CLAUDE.md` lists every place to touch.
