const { spawnSync } = require('child_process')
const path = require('path')

const target = process.argv[2] === 'portable' ? 'portable' : 'nsis'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const output = path.join('exports', `${target}-${stamp}`)
const builder = path.join(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
)

const result = spawnSync(
  builder,
  ['--win', target, `--config.directories.output=${output}`],
  {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status || 1)
}

console.log(`Desktop export created in ${output}`)
