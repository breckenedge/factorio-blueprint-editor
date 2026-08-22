#!/usr/bin/env node
/**
 * Runs `tsc` and compares the result against a recorded per-file baseline.
 *
 * Fails when a file gains errors or a new file starts producing them, so that
 * the type-checker is a usable signal while a backlog of known errors exists.
 *
 * Pass --update to rewrite the baseline from the current output.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'typecheck-baseline.json')

/**
 * Errors that mean tsc never got as far as checking code. tsc reports these and
 * exits without type-checking anything, which looks indistinguishable from
 * success if you only count errors: a missing `types` entry yields exactly one
 * error and zero findings. Treated as a hard failure so a broken toolchain can
 * never read as a clean run.
 */
const FATAL_CODES = new Set([
    'TS2688', // Cannot find type definition file for '...'
    'TS5083', // Cannot read file '...tsconfig.json'
    'TS6053', // File '...' not found
    'TS6231', // Could not resolve the path to a project
])

const LINE = /^(?<file>[^(]+)\((?<line>\d+),\d+\): error (?<code>TS\d+):/

function runTsc() {
    try {
        execFileSync('npx', ['tsc'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
        return ''
    } catch (err) {
        // tsc exits non-zero whenever it reports anything; output is the payload.
        return `${err.stdout ?? ''}${err.stderr ?? ''}`
    }
}

function parse(output) {
    const perFile = {}
    const fatal = []
    for (const raw of output.split('\n')) {
        const m = LINE.exec(raw.trim())
        if (!m) {
            const bare = /error (TS\d+):/.exec(raw)
            if (bare && FATAL_CODES.has(bare[1])) fatal.push(raw.trim())
            continue
        }
        const { file, code } = m.groups
        if (FATAL_CODES.has(code)) fatal.push(raw.trim())
        perFile[file] = (perFile[file] ?? 0) + 1
    }
    return { perFile, fatal }
}

const { perFile, fatal } = parse(runTsc())
const total = Object.values(perFile).reduce((a, b) => a + b, 0)

if (fatal.length > 0) {
    console.error('Type-check did not run.\n')
    for (const f of fatal) console.error(`  ${f}`)
    console.error(
        '\nThese errors stop tsc before it checks any code, so the error count',
        '\nbelow is meaningless. Usually a dependency providing ambient types is',
        '\nnested rather than hoisted, leaving the root tsconfig unable to resolve',
        '\nit. Fix resolution before trusting any result.'
    )
    process.exit(1)
}

if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify({ total, perFile }, null, 4)}\n`)
    console.log(`Baseline written: ${total} errors across ${Object.keys(perFile).length} files.`)
    process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
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
    console.log('Fewer errors than the baseline:\n')
    for (const i of improvements) console.log(`  ${i}`)
    console.log('\nRun `npm run type-check:ratchet -- --update` to lock the improvement in.\n')
}

if (regressions.length > 0) {
    console.error('Type errors increased:\n')
    for (const r of regressions) console.error(`  ${r}`)
    console.error(`\nTotal ${baseline.total} -> ${total}.`)
    process.exit(1)
}

console.log(`Type errors within baseline (${total}/${baseline.total}).`)
