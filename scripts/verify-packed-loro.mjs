import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const PACKAGE_NAME = '@lobehub/editor';
const LORO_PACKAGE = 'loro-crdt';
const LORO_VERSION = '1.16.1';

function packageJsonFromRoot(packageRoot) {
  return JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function installedPackageVersion(repositoryRoot, packageName) {
  const packageJsonPath = path.join(
    repositoryRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  if (!existsSync(packageJsonPath)) return undefined;
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
}

function installedPackageJson(repositoryRoot, packageName) {
  const packageJsonPath = path.join(
    repositoryRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  if (!existsSync(packageJsonPath)) return undefined;
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

function consumerPeerDependencies(repositoryRoot, peerDependencies) {
  const resolved = { ...peerDependencies };
  const queue = Object.keys(resolved);
  for (let index = 0; index < queue.length; index += 1) {
    const packageJson = installedPackageJson(repositoryRoot, queue[index]);
    for (const [name, version] of Object.entries(packageJson?.peerDependencies ?? {})) {
      if (resolved[name] !== undefined) continue;
      resolved[name] = version;
      queue.push(name);
    }
  }
  return resolved;
}

function consumerTypeDependencies(repositoryRoot, sourcePackageJson) {
  const declared = sourcePackageJson.devDependencies ?? {};
  return Object.fromEntries(
    ['@types/react', '@types/react-dom', 'jsdom', 'typescript', 'vite', 'vitest'].map((name) => {
      const version = installedPackageVersion(repositoryRoot, name) ?? declared[name];
      assert.ok(version, `cannot derive ${name} from repository devDependencies or node_modules`);
      return [name, version];
    }),
  );
}

export function assertPackedPackageMetadata(packageJson) {
  assert.equal(
    packageJson.dependencies?.[LORO_PACKAGE],
    undefined,
    'loro-crdt must not be a runtime dependency of the packed package',
  );
  assert.equal(
    packageJson.peerDependencies?.[LORO_PACKAGE],
    LORO_VERSION,
    'loro-crdt must be an exact peer dependency',
  );
  assert.deepEqual(
    packageJson.peerDependenciesMeta?.[LORO_PACKAGE],
    { optional: true },
    'loro-crdt peer dependency must be optional',
  );
  assert.equal(
    packageJson.devDependencies?.[LORO_PACKAGE],
    undefined,
    'clean-package must remove devDependencies from the packed artifact',
  );
}

export function assertPackedPatchAssets(packageRoot) {
  assert.ok(
    existsSync(path.join(packageRoot, 'scripts', 'postinstall-lexical-patch.cjs')),
    'packed package must contain its reviewed Lexical postinstall patcher',
  );
  assert.ok(
    existsSync(path.join(packageRoot, 'patches', 'lexical@0.42.0.patch')),
    'packed package must contain the Lexical compatibility patch',
  );
  assert.ok(
    existsSync(path.join(packageRoot, 'patches', '@lexical__yjs@0.42.0.patch')),
    'packed package must contain the Lexical Yjs compatibility patch',
  );
}

export function assertPackedExports(packageRoot, packageJson) {
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    if (typeof target === 'string') {
      assert.ok(
        existsSync(path.join(packageRoot, target)),
        `packed export ${subpath} is missing ${target}`,
      );
      continue;
    }
    for (const condition of ['types', 'import']) {
      const targetPath = target?.[condition];
      if (typeof targetPath !== 'string') continue;
      assert.ok(
        existsSync(path.join(packageRoot, targetPath)),
        `packed export ${subpath}.${condition} is missing ${targetPath}`,
      );
    }
  }
}

function listFiles(root) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  };
  visit(root);
  return files;
}

export function findPropertiesStateDefinitions(esRoot) {
  return listFiles(esRoot)
    .filter((filePath) => filePath.endsWith('.js'))
    .flatMap((filePath) => {
      const contents = readFileSync(filePath, 'utf8');
      const matches = contents.match(/createState\((?:"properties"|'properties')/g) ?? [];
      return matches.map(() => filePath);
    });
}

export function assertSinglePropertiesState(esRoot) {
  const definitions = findPropertiesStateDefinitions(esRoot);
  assert.equal(
    definitions.length,
    1,
    `packed unbundle output must define one properties StateConfig; found ${definitions.length}: ${definitions.join(', ')}`,
  );
  assert.equal(
    path.relative(esRoot, definitions[0]),
    path.join('plugins', 'properties', 'state.js'),
    'properties StateConfig must live in the shared unbundled state module',
  );
  return definitions;
}

export function assertDefaultEntriesDoNotReferenceLoro(packageRoot) {
  const entries = ['es/index.js', 'es/react.js', 'es/headless.js', 'es/collaboration.js'];
  const visited = new Set();
  const violations = [];
  const visit = (filePath) => {
    if (visited.has(filePath) || !existsSync(filePath)) return;
    visited.add(filePath);
    const contents = readFileSync(filePath, 'utf8');
    const imports = contents.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g);
    for (const [, specifier] of imports) {
      if (specifier === LORO_PACKAGE || specifier.startsWith(`${LORO_PACKAGE}/`)) {
        violations.push({ filePath, specifier });
        continue;
      }
      if (!specifier.startsWith('.')) continue;
      const target = path.resolve(path.dirname(filePath), specifier);
      const candidates = [target, `${target}.js`, `${target}.mjs`, path.join(target, 'index.js')];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (resolved) visit(resolved);
    }
  };
  for (const entry of entries) visit(path.join(packageRoot, entry));
  assert.deepEqual(
    violations,
    [],
    `default package entries reference optional Loro: ${JSON.stringify(violations)}`,
  );
  return [...visited];
}

export function assertDefaultDeclarationsDoNotReferenceLoro(packageRoot) {
  const entries = ['es/index.d.ts', 'es/react.d.ts', 'es/headless.d.ts', 'es/collaboration.d.ts'];
  const visited = new Set();
  const violations = [];
  const visit = (filePath) => {
    if (visited.has(filePath) || !existsSync(filePath)) return;
    visited.add(filePath);
    const contents = readFileSync(filePath, 'utf8');
    const directReferences = contents.match(/['"]loro-crdt(?:\/[^'"]*)?['"]/g) ?? [];
    for (const reference of directReferences) violations.push({ filePath, reference });
    const imports = contents.matchAll(
      /(?:from|import|export)\s*(?:type\s*)?(?:\(\s*)?['"]([^'"]+)['"]/g,
    );
    for (const [, specifier] of imports) {
      if (!specifier.startsWith('.')) continue;
      const target = path.resolve(path.dirname(filePath), specifier);
      const declarationTarget = target.replace(/\.(?:c|m)?js$/, '');
      const candidates = [
        `${declarationTarget}.d.ts`,
        `${declarationTarget}.d.mts`,
        `${declarationTarget}.d.cts`,
        path.join(declarationTarget, 'index.d.ts'),
        `${declarationTarget}.ts`,
        target,
      ];
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (resolved) visit(resolved);
    }
  };
  for (const entry of entries) visit(path.join(packageRoot, entry));
  assert.deepEqual(
    violations,
    [],
    `default package declarations reference optional Loro: ${JSON.stringify(violations)}`,
  );
  return [...visited];
}

function cleanChildEnvironment() {
  const environment = { ...process.env };
  for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'npm_config_node_path']) {
    delete environment[key];
  }
  return environment;
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      env: cleanChildEnvironment(),
      stdio: options.stdio ?? 'pipe',
    });
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${error.status ?? 'unknown'}\n${stdout}${stderr}`,
      { cause: error },
    );
  }
}

function packPackage({ packageManager, repositoryRoot, artifactDirectory }) {
  const command = packageManager === 'npm' ? 'npm' : 'pnpm';
  const args =
    packageManager === 'npm'
      ? ['pack', '--pack-destination', artifactDirectory]
      : ['pack', '--pack-destination', artifactDirectory];
  run(command, args, { cwd: repositoryRoot });

  const tarballs = readdirSync(artifactDirectory)
    .filter((entry) => entry.endsWith('.tgz'))
    .map((entry) => path.join(artifactDirectory, entry));
  assert.equal(tarballs.length, 1, `expected one packed tarball, found ${tarballs.length}`);
  return tarballs[0];
}

function writeConsumerPackage(
  consumerDirectory,
  tarballPath,
  peerDependencies,
  developmentDependencies,
  includeLoro,
) {
  const dependencies = {
    [PACKAGE_NAME]: `file:${tarballPath}`,
  };
  for (const [name, version] of Object.entries(peerDependencies)) {
    if (name === LORO_PACKAGE) continue;
    dependencies[name] = version;
  }
  if (includeLoro) dependencies[LORO_PACKAGE] = LORO_VERSION;

  const devDependencies = includeLoro
    ? {}
    : {
        '@types/react': developmentDependencies['@types/react'],
        '@types/react-dom': developmentDependencies['@types/react-dom'],
        'jsdom': developmentDependencies.jsdom,
        'typescript': developmentDependencies.typescript,
        'vite': developmentDependencies.vite,
        'vitest': developmentDependencies.vitest,
      };

  writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: includeLoro ? 'packed-editor-loro-consumer' : 'packed-editor-default-consumer',
        private: true,
        type: 'module',
        dependencies,
        ...(Object.keys(devDependencies).length > 0 ? { devDependencies } : {}),
      },
      null,
      2,
    )}\n`,
  );
}

function runDefaultTypeCheck(consumerDirectory, packageManager, logger) {
  writeFileSync(
    path.join(consumerDirectory, 'default-types.ts'),
    `import type {
  CollaborativeAgentEditorConnectOptions,
  HeadlessEditor,
} from '${PACKAGE_NAME}/headless';

const headless: HeadlessEditor | undefined = undefined;
const connect: CollaborativeAgentEditorConnectOptions | undefined = undefined;
void headless;
void connect;
`,
  );
  writeFileSync(
    path.join(consumerDirectory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          esModuleInterop: true,
          jsx: 'react-jsx',
          lib: ['dom', 'dom.iterable', 'esnext'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: 'ES2022',
        },
        files: ['default-types.ts'],
      },
      null,
      2,
    )}\n`,
  );

  const command = packageManager === 'npm' ? 'npx' : 'pnpm';
  const args =
    packageManager === 'npm'
      ? ['--no-install', 'tsc', '--project', 'tsconfig.json']
      : ['exec', 'tsc', '--project', 'tsconfig.json'];
  const result = spawnSync(command, args, {
    cwd: consumerDirectory,
    encoding: 'utf8',
    env: cleanChildEnvironment(),
  });
  if (result.status === 0) return;

  const diagnostics = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const lines = diagnostics.split(/\r?\n/).filter(Boolean);
  const editorDiagnostics = lines.filter((line) =>
    /node_modules[\\/]@lobehub[\\/]editor|loro-crdt/.test(line),
  );
  const thirdPartyDiagnostics = lines.filter(
    (line) => !/node_modules[\\/]@lobehub[\\/]editor|loro-crdt/.test(line),
  );
  const details = [
    editorDiagnostics.length > 0
      ? `editor declaration diagnostics:\n${editorDiagnostics.join('\n')}`
      : 'editor declaration diagnostics: none',
    thirdPartyDiagnostics.length > 0
      ? `third-party or fixture diagnostics:\n${thirdPartyDiagnostics.join('\n')}`
      : 'third-party or fixture diagnostics: none',
  ].join('\n');
  logger(
    `default consumer tsc exited ${result.status ?? 'unknown'}; diagnostics are classified below:\n${details}`,
  );
  throw new Error(`default consumer type-check failed with skipLibCheck=false:\n${details}`);
}

function runDefaultEntryCheck(consumerDirectory, packageManager) {
  const fixture = path.join(consumerDirectory, 'default-entry-check.test.mjs');
  writeFileSync(
    path.join(consumerDirectory, 'vitest.config.mjs'),
    `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    server: { deps: { inline: true } },
  },
});
`,
  );
  writeFileSync(
    fixture,
    `import * as root from '${PACKAGE_NAME}';
import * as react from '${PACKAGE_NAME}/react';
import * as headless from '${PACKAGE_NAME}/headless';
import * as collaboration from '${PACKAGE_NAME}/collaboration';
import { expect, it } from 'vitest';

it('loads default entries without Loro and preserves StateConfig identity', () => {
  expect(root.propertiesState).toBeDefined();
  expect(headless.propertiesState).toBeDefined();
  expect(root.propertiesState).toBe(headless.propertiesState);
  expect(react.EditorProvider).toBeDefined();
  expect(headless.createHeadlessEditor).toBeDefined();
  expect(collaboration.CollaborationTransportCore).toBeDefined();
});
`,
  );
  const command = packageManager === 'npm' ? 'npx' : 'pnpm';
  const fixtureName = path.basename(fixture);
  const args =
    packageManager === 'npm'
      ? ['--no-install', 'vitest', 'run', '--config', 'vitest.config.mjs', fixtureName]
      : ['exec', 'vitest', 'run', '--config', 'vitest.config.mjs', fixtureName];
  run(command, args, { cwd: consumerDirectory });
}

function installConsumer(consumerDirectory, packageManager, offline) {
  const offlineArgs = offline ? ['--offline'] : [];
  if (packageManager === 'npm') {
    run('npm', ['install', ...offlineArgs, '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: consumerDirectory,
    });
    return;
  }

  run('pnpm', ['install', ...offlineArgs, '--ignore-scripts', '--config.lockfile=false'], {
    cwd: consumerDirectory,
  });
}

function runInstalledPostinstall(consumerDirectory) {
  const patchScript = path.join(
    consumerDirectory,
    'node_modules',
    '@lobehub',
    'editor',
    'scripts',
    'postinstall-lexical-patch.cjs',
  );
  assert.ok(existsSync(patchScript), 'installed tarball must expose its postinstall patcher');
  const output = run(process.execPath, [patchScript], { cwd: consumerDirectory });
  assert.match(output, /Applied Lexical compatibility patch/);
  assert.match(output, /Applied Lexical Yjs compatibility patch/);
  return output;
}

function createConsumerFixture(consumerDirectory, name, source) {
  const fixturePath = path.join(consumerDirectory, `${name}.mjs`);
  writeFileSync(fixturePath, source);
  return fixturePath;
}

function runConsumerFixture(consumerDirectory, fixturePath) {
  run(process.execPath, [fixturePath], { cwd: consumerDirectory });
}

function findPackageDirectories(root, packageName) {
  const packagePath = packageName.split('/');
  const matches = [];
  const visit = (current, depth) => {
    if (depth > 8 || !existsSync(current)) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.name === 'node_modules') {
        const candidate = path.join(entryPath, ...packagePath);
        if (existsSync(candidate)) matches.push(candidate);
        visit(entryPath, depth + 1);
        continue;
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(entryPath, depth + 1);
    }
  };
  visit(root, 0);
  return matches;
}

function assertConsumerHasNoLoro(consumerDirectory) {
  const matches = findPackageDirectories(consumerDirectory, LORO_PACKAGE);
  assert.deepEqual(
    matches,
    [],
    `default consumer unexpectedly has ${LORO_PACKAGE} available: ${matches.join(', ')}`,
  );
  const resolutionFixture = path.join(consumerDirectory, 'missing-loro-check.mjs');
  const require = createRequire(pathToFileURL(resolutionFixture));
  assert.throws(
    () => require.resolve(LORO_PACKAGE),
    (error) => error?.code === 'MODULE_NOT_FOUND',
    `${LORO_PACKAGE} must fail require.resolve from the default consumer`,
  );
  const importFixture = createConsumerFixture(
    consumerDirectory,
    'missing-loro-import-check',
    `try {
  await import.meta.resolve('${LORO_PACKAGE}');
  throw new Error('${LORO_PACKAGE} unexpectedly resolved through import.meta.resolve');
} catch (error) {
  if (!['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code)) throw error;
}
`,
  );
  runConsumerFixture(consumerDirectory, importFixture);
}

function assertPackageResolutionStaysInConsumer(consumerDirectory, packageName) {
  const fixture = path.join(consumerDirectory, 'resolution-check.mjs');
  const require = createRequire(pathToFileURL(fixture));
  const resolved = require.resolve(packageName);
  const realConsumerDirectory = realpathSync(consumerDirectory);
  const realResolved = realpathSync(resolved);
  assert.equal(
    path.relative(realConsumerDirectory, realResolved).startsWith('..'),
    false,
    `${packageName} resolved outside the isolated consumer: ${resolved}`,
  );
  return realResolved;
}

function unpackTarball(tarballPath, artifactDirectory) {
  const extractDirectory = path.join(artifactDirectory, 'unpacked');
  mkdirSync(extractDirectory);
  run('tar', ['-xzf', tarballPath, '-C', extractDirectory]);
  const packageRoot = path.join(extractDirectory, 'package');
  assert.ok(existsSync(packageRoot), 'packed tarball must contain a package directory');
  return packageRoot;
}

function verifyDefaultConsumer(consumerDirectory, packageManager, logger) {
  assertConsumerHasNoLoro(consumerDirectory);
  runDefaultEntryCheck(consumerDirectory, packageManager);
  runDefaultTypeCheck(consumerDirectory, packageManager, logger);
}

function verifyLoroConsumer(consumerDirectory) {
  assertPackageResolutionStaysInConsumer(consumerDirectory, LORO_PACKAGE);
  const fixture = createConsumerFixture(
    consumerDirectory,
    'loro-entry-check',
    `import * as loro from '${PACKAGE_NAME}/loro';
import * as react from '${PACKAGE_NAME}/loro/react';
import * as headless from '${PACKAGE_NAME}/loro/headless';
import { LoroDoc } from '${LORO_PACKAGE}';
if (typeof loro.LoroPlugin !== 'function' || typeof react.LoroReactPlugin !== 'function') {
  throw new Error('explicit Loro entrypoints did not load');
}
if (typeof headless.createLoroHeadlessFactory !== 'function') {
  throw new Error('explicit Loro headless entrypoint did not load');
}
if (!(new LoroDoc())) throw new Error('host Loro dependency did not instantiate');
`,
  );
  runConsumerFixture(consumerDirectory, fixture);
}

export function verifyPackedLoro({
  packageManager = process.env.PACKED_LORO_PACKAGE_MANAGER ?? 'pnpm',
  repositoryRoot = REPOSITORY_ROOT,
  offline = process.env.PACKED_LORO_OFFLINE === '1',
  keepTemporaryFiles = process.env.KEEP_PACKED_LORO_TEMP === '1',
  logger = console.log,
} = {}) {
  assert.ok(
    ['npm', 'pnpm'].includes(packageManager),
    `unsupported package manager: ${packageManager}`,
  );

  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'lobe-editor-packed-loro-'));
  const artifactDirectory = path.join(temporaryRoot, 'artifacts');
  mkdirSync(artifactDirectory);

  try {
    const tarballPath = packPackage({ packageManager, repositoryRoot, artifactDirectory });
    const packageRoot = unpackTarball(tarballPath, artifactDirectory);
    const packedPackageJson = packageJsonFromRoot(packageRoot);
    const sourcePackageJson = packageJsonFromRoot(repositoryRoot);
    const consumerPeers = consumerPeerDependencies(
      repositoryRoot,
      packedPackageJson.peerDependencies ?? {},
    );
    const typeDependencies = consumerTypeDependencies(repositoryRoot, sourcePackageJson);
    assertPackedPackageMetadata(packedPackageJson);
    assertPackedPatchAssets(packageRoot);
    assertPackedExports(packageRoot, packedPackageJson);
    const defaultEntryFiles = assertDefaultEntriesDoNotReferenceLoro(packageRoot);
    const defaultDeclarationFiles = assertDefaultDeclarationsDoNotReferenceLoro(packageRoot);
    const stateDefinitions = assertSinglePropertiesState(path.join(packageRoot, 'es'));

    const defaultConsumer = path.join(temporaryRoot, 'consumer-default');
    const loroConsumer = path.join(temporaryRoot, 'consumer-loro');
    mkdirSync(defaultConsumer);
    mkdirSync(loroConsumer);
    writeConsumerPackage(defaultConsumer, tarballPath, consumerPeers, typeDependencies, false);
    writeConsumerPackage(loroConsumer, tarballPath, consumerPeers, typeDependencies, true);

    installConsumer(defaultConsumer, packageManager, offline);
    runInstalledPostinstall(defaultConsumer);
    verifyDefaultConsumer(defaultConsumer, packageManager, logger);
    installConsumer(loroConsumer, packageManager, offline);
    runInstalledPostinstall(loroConsumer);
    verifyLoroConsumer(loroConsumer);

    const result = {
      packageManager,
      tarballPath,
      defaultConsumer,
      loroConsumer,
      stateDefinitions,
      defaultEntryFiles,
      defaultDeclarationFiles,
    };
    logger(
      `PASS packed Loro verification: ${packageManager} pack; ${offline ? 'offline ' : ''}default consumer has no Loro; explicit Loro entries resolve; StateConfig definitions=${stateDefinitions.length}`,
    );
    if (!keepTemporaryFiles) rmSync(temporaryRoot, { force: true, recursive: true });
    return result;
  } catch (error) {
    if (keepTemporaryFiles) {
      logger(`packed Loro verification fixtures kept at ${temporaryRoot}`);
    } else {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
    throw error;
  }
}

if (path.resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  verifyPackedLoro({ offline: process.argv.includes('--offline') });
}
