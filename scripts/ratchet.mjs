#!/usr/bin/env node
/**
 * Runs a checker and compares its output against a recorded per-file baseline.
 *
 * Both eslint and tsc report a backlog of pre-existing problems on master.
 * Neither can be made to exit 0 without a large cleanup, which leaves them
 * useless as signals: a run that is red before and after a change says nothing.
 * Recording the per-file counts and failing only on an increase makes them
 * useful today, and lets the backlog shrink over time.
 *
 * Usage:
 *   node scripts/ratchet.mjs typecheck [--update]
 *   node scripts/ratchet.mjs lint      [--update]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Errors that mean the checker never got as far as inspecting code. tsc reports
 * these and exits without checking anything, which is indistinguishable from
 * success if you only count errors: a missing `types` entry yields exactly one
 * error and zero findings. Treated as a hard failure so a broken toolchain can
 * never read as a clean run, or worse, as a large improvement.
 */
const FATAL_TS_CODES = new Set([
    'TS2688', // Cannot find type definition file for '...'
    'TS5083', // Cannot read file '...tsconfig.json'
    'TS6053', // File '...' not found
    'TS6231', // Could not resolve the path to a project
])

const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),\d+\): error (?<code>TS\d+):/

const TOOLS = {
    typecheck: {
        baseline: 'typecheck-baseline.json',
        run: () => exec('npx', ['tsc']),
        parse(output) {
            const perFile = {}
            const fatal = []
            for (const raw of output.split('\n')) {
                const trimmed = raw.trim()
                const m = TSC_LINE.exec(trimmed)
                if (!m) {
                    const bare = /error (TS\d+):/.exec(trimmed)
                    if (bare && FATAL_TS_CODES.has(bare[1])) fatal.push(trimmed)
                    continue
                }
                if (FATAL_TS_CODES.has(m.groups.code)) fatal.push(trimmed)
                perFile[m.groups.file] = (perFile[m.groups.file] ?? 0) + 1
            }
            return { perFile, fatal }
        },
        fatalHint:
            'These errors stop tsc before it checks any code, so the count is\n' +
            'meaningless. Usually a dependency providing ambient types is nested\n' +
            'rather than hoisted, leaving the root tsconfig unable to resolve it.',
    },
    lint: {
        baseline: 'lint-baseline.json',
        run: () => exec('npx', ['eslint', '.', '--format', 'json']),
        parse(output) {
            const start = output.indexOf('[')
            if (start === -1) {
                return { perFile: {}, fatal: ['eslint produced no JSON report.'] }
            }
            const report = JSON.parse(output.slice(start))
            const perFile = {}
            for (const file of report) {
                if (file.errorCount > 0) {
                    perFile[relative(ROOT, file.filePath)] = file.errorCount
                }
            }
            // eslint reporting nothing at all means it matched no files, which
            // silently passes rather than checking anything.
            const fatal = report.length === 0 ? ['eslint matched no files.'] : []
            return { perFile, fatal }
        },
        fatalHint:
            'eslint did not report on any file, so the count is meaningless.\n' +
            'Check the config’s `files`/`ignores` before trusting any result.',
    },
}

function exec(cmd, args) {
    try {
        return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    } catch (err) {
        // Both tools exit non-zero whenever they report anything; the output is
        // the payload, not a failure to run.
        return `${err.stdout ?? ''}${err.stderr ?? ''}`
    }
}

const name = process.argv[2]
const tool = TOOLS[name]
if (!tool) {
    console.error(`Usage: node scripts/ratchet.mjs <${Object.keys(TOOLS).join('|')}> [--update]`)
    process.exit(2)
}

const baselinePath = join(ROOT, tool.baseline)
const { perFile, fatal } = tool.parse(tool.run())
const total = Object.values(perFile).reduce((a, b) => a + b, 0)

if (fatal.length > 0) {
    console.error(`${name}: the check did not run.\n`)
    for (const f of fatal) console.error(`  ${f}`)
    console.error(`\n${tool.fatalHint}`)
    process.exit(1)
}

if (process.argv.includes('--update')) {
    writeFileSync(baselinePath, `${JSON.stringify({ total, perFile }, null, 4)}\n`)
    console.log(`${name}: baseline written — ${total} across ${Object.keys(perFile).length} files.`)
    process.exit(0)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const regressions = []
const improvements = []

for (const [file, count] of Object.entries(perFile)) {
    const was = baseline.perFile[file] ?? 0
    if (count > was) regressions.push(`${file}: ${was} -> ${count}`)
}
for (const [file, was] of Object.entries(baseline.perFile)) {
    const count = perFile[file] ?? 0
    if (count < was) improvements.push(`${file}: ${was} -> ${count}`)
}

if (improvements.length > 0) {
    console.log(`${name}: fewer problems than the baseline\n`)
    for (const i of improvements) console.log(`  ${i}`)
    console.log(`\nRun \`npm run ${name}:ratchet -- --update\` to lock the improvement in.\n`)
}

if (regressions.length > 0) {
    console.error(`${name}: problems increased\n`)
    for (const r of regressions) console.error(`  ${r}`)
    console.error(`\nTotal ${baseline.total} -> ${total}.`)
    process.exit(1)
}

console.log(`${name}: within baseline (${total}/${baseline.total}).`)
