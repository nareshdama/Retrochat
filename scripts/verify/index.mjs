import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

function runStep(name, command, args) {
  // eslint-disable-next-line no-console
  console.log(`\n[verify] ${name}...`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    throw new Error(`[verify] ${name} failed with exit code ${result.status}`)
  }
}

function walk(dir) {
  const entries = readdirSync(dir)
  const results = []
  for (const entry of entries) {
    const full = path.join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      results.push(...walk(full))
    } else if (stats.isFile() && full.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

function assertEncryptedStorage() {
  const storageDir = path.join(process.cwd(), 'src', 'storage')
  const files = walk(storageDir)

  const suspicious = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (line.includes('localStorage') || line.includes('sessionStorage')) {
        suspicious.push({
          file,
          line: index + 1,
          reason: 'Direct browser storage API usage is not allowed in storage layer.',
        })
      }
    })

    // Heuristic: any call to db.put(...) in storage layer should be adjacent to
    // AEAD-based encryption, otherwise we might be writing plaintext.
    lines.forEach((line, index) => {
      if (!line.includes('db.put(')) return

      const windowStart = Math.max(0, index - 8)
      const windowEnd = Math.min(lines.length - 1, index + 2)
      const windowLines = lines.slice(windowStart, windowEnd + 1).join('\n')

      const hasEncryptionCall =
        windowLines.includes('encryptAead(') ||
        windowLines.includes('encryptDSK(') ||
        windowLines.includes('blob:')

      if (!hasEncryptionCall) {
        suspicious.push({
          file,
          line: index + 1,
          reason:
            'db.put call in storage layer is not clearly associated with AEAD encryption (possible plaintext write).',
        })
      }
    })
  }

  if (suspicious.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n[verify] Plaintext storage check FAILED. Suspicious writes detected:')
    for (const issue of suspicious) {
      // eslint-disable-next-line no-console
      console.error(` - ${issue.file}:${issue.line} -> ${issue.reason}`)
    }
    throw new Error('Plaintext may be written to storage layer; see log above.')
  }

  // eslint-disable-next-line no-console
  console.log('[verify] Encrypted storage check passed.')
}

async function main() {
  try {
    runStep('lint', 'pnpm', ['lint'])
    runStep('typecheck', 'pnpm', ['typecheck'])
    runStep('unit tests', 'pnpm', ['test:unit'])
    runStep('e2e tests', 'pnpm', ['test:e2e'])
    assertEncryptedStorage()
    // eslint-disable-next-line no-console
    console.log('\n[verify] All checks passed.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`\n[verify] FAILED: ${(error && error.message) || error}`)
    process.exitCode = 1
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main()

