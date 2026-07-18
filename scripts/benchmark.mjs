import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env.local')
const RESULTS_PATH = join(__dirname, '..', 'benchmark-results.json')

const envRaw = readFileSync(ENV_PATH, 'utf-8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const PROVIDER_CONFIGS = {
  groq:     { baseUrl: 'https://api.groq.com/openai/v1', key: env.GROQ_API_KEY,
              models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  mistral:  { baseUrl: 'https://api.mistral.ai/v1', key: env.MISTRAL_API_KEY,
              models: ['mistral-medium', 'mistral-small'] },
  openrouter:{ baseUrl: 'https://openrouter.ai/api/v1', key: env.OPENROUTER_API_KEY,
              models: ['openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct'] },
  nvidia:   { baseUrl: 'https://integrate.api.nvidia.com/v1', key: env.NVIDIA_API_KEY,
              models: ['nvidia/nemotron-3-ultra-550b-a55b', 'deepseek-ai/deepseek-v4-flash'] },
  cloudflare:{ baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run`,
               key: env.CLOUDFLARE_API_TOKEN,
               models: ['@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/meta/llama-3.2-3b-instruct'] },
}

const TEST_PROMPT = 'What is 2+2? Reply with only the number.'

const RUNS_PER_MODEL = 3
const TIMEOUT_MS = 60_000

function elapsed(start) {
  return Number((performance.now() - start) / 1000).toFixed(2)
}

function formatTime(seconds) {
  return `${seconds}s`
}

function statusIcon(ok) {
  return ok ? '✔' : '✘'
}

async function testModel(providerName, model, runNumber) {
  const cfg = PROVIDER_CONFIGS[providerName]
  if (!cfg || !cfg.key) return { provider: providerName, model, success: false, error: 'No API key configured', avgLatency: '—', avgTtft: '—', status: 'SKIP' }

  const url = providerName === 'cloudflare'
    ? `${cfg.baseUrl}/${model}`
    : `${cfg.baseUrl}/chat/completions`

  const body = providerName === 'cloudflare'
    ? { messages: [{ role: 'user', content: TEST_PROMPT }] }
    : { model, messages: [{ role: 'user', content: TEST_PROMPT }], max_tokens: 10, temperature: 0 }

  const start = performance.now()
  let ttft = null
  let fullText = ''
  let error = null

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
        ...(providerName === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3000' } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      let reason = errBody
      try {
        const j = JSON.parse(errBody)
        reason = j.error?.message || j.error || j.errors?.[0]?.message || errBody
      } catch {}
      return { provider: providerName, model, success: false, error: `HTTP ${response.status}: ${reason.slice(0, 200)}`, avgLatency: '—', avgTtft: '—', status: 'FAIL', run: runNumber }
    }

    // Non-streaming — measure total time
    const data = await response.json()
    const latency = performance.now() - start

    if (data.choices?.[0]?.message?.content) {
      fullText = data.choices[0].message.content
    } else if (data.result?.response) {
      fullText = data.result.response
    }

    return {
      provider: providerName,
      model,
      success: true,
      error: null,
      avgLatency: (latency / 1000).toFixed(2),
      avgTtft: (latency / 1000).toFixed(2),
      status: 'OK',
      run: runNumber,
      responseLength: fullText.length,
    }
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? 'TIMEOUT' : err.message
    return { provider: providerName, model, success: false, error: msg, avgLatency: '—', avgTtft: '—', status: 'FAIL', run: runNumber }
  }
}

async function runBenchmarks() {
  console.log('AI Copilot OS — Provider/Model Benchmark')
  console.log('='.repeat(70))
  console.log(`Prompt: "${TEST_PROMPT}"`)
  console.log(`Runs per model: ${RUNS_PER_MODEL}`)
  console.log(`Date: ${new Date().toISOString()}`)
  console.log('')

  const allResults = []

  for (const [providerName, cfg] of Object.entries(PROVIDER_CONFIGS)) {
    const available = !!cfg.key
    console.log(`\n${statusIcon(available)} ${providerName.toUpperCase()} (key: ${available ? 'configured' : 'MISSING'})`)
    console.log('-'.repeat(50))

    if (!available) {
      for (const model of cfg.models) {
        allResults.push({ provider: providerName, model, success: false, error: 'No API key configured', avgLatency: '—', avgTtft: '—', status: 'SKIP' })
        console.log(`  ${statusIcon(false)} ${model}  —  SKIP (no key)`)
      }
      continue
    }

    for (const model of cfg.models) {
      const runResults = []
      for (let run = 1; run <= RUNS_PER_MODEL; run++) {
        process.stdout.write(`  ${model} (run ${run}/${RUNS_PER_MODEL}) ... `)
        const result = await testModel(providerName, model, run)
        runResults.push(result)
        allResults.push(result)
        console.log(result.success ? `✔ ${result.avgLatency}s` : `✘ ${result.error?.slice(0, 60)}`)
        // Small delay between runs to avoid rate limits
        if (run < RUNS_PER_MODEL) await new Promise(r => setTimeout(r, 1000))
      }

      // Compute averages
      const successes = runResults.filter(r => r.success)
      const avgLatency = successes.length > 0
        ? (successes.reduce((s, r) => s + parseFloat(r.avgLatency), 0) / successes.length).toFixed(2)
        : '—'
      const avgTtft = avgLatency
      const successRate = `${runResults.filter(r => r.success).length}/${RUNS_PER_MODEL}`
      console.log(`  → AVG: ${avgLatency}s  |  Success: ${successRate}`)
      console.log('')

      if (successes.length === 0) {
        const errors = runResults.map(r => r.error).filter(Boolean)
        console.log(`  → Errors: ${[...new Set(errors)].join('; ')}`)
      }
    }
  }

  // Save results
  const output = { timestamp: new Date().toISOString(), prompt: TEST_PROMPT, runsPerModel: RUNS_PER_MODEL, results: allResults }
  writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2))

  // Print summary table
  console.log('\n\n')
  console.log('RESULTS SUMMARY')
  console.log('='.repeat(70))
  console.log('')
  console.log('| Provider | Model | Avg Latency | Success Rate | Notes |')
  console.log('|' + '-'.repeat(10) + '|' + '-'.repeat(30) + '|' + '-'.repeat(14) + '|' + '-'.repeat(14) + '|' + '-'.repeat(30) + '|')

  // Group by provider
  const byProvider = {}
  for (const r of allResults) {
    if (!byProvider[r.provider]) byProvider[r.provider] = []
    byProvider[r.provider].push(r)
  }

  for (const [provider, results] of Object.entries(byProvider)) {
    const byModel = {}
    for (const r of results) {
      if (!byModel[r.model]) byModel[r.model] = []
      byModel[r.model].push(r)
    }

    for (const [model, modelResults] of Object.entries(byModel)) {
      const successes = modelResults.filter(r => r.success)
      const avgLat = successes.length > 0
        ? (successes.reduce((s, r) => s + parseFloat(r.avgLatency), 0) / successes.length).toFixed(2) + 's'
        : '—'
      const successRate = `${successes.length}/${modelResults.length}`
      const errors = [...new Set(modelResults.map(r => r.error).filter(Boolean))]
      const notes = successes.length === 0
        ? (errors[0]?.includes('No API key') ? 'No key' : errors[0]?.slice(0, 40) || 'FAIL')
        : 'OK'
      console.log(`| ${provider.padEnd(8)} | ${model.padEnd(28)} | ${avgLat.padEnd(12)} | ${successRate.padEnd(12)} | ${notes.padEnd(28)} |`)
    }
  }

  console.log('\n')
  console.log(`Full results saved to: benchmark-results.json`)
}

// Agent-loop task tests
const AGENT_TASKS = [
  { id: 1, task: 'What is the capital of France? Reply with just the city name.', expected: 'Paris' },
  { id: 2, task: 'Write a JavaScript function named "reverse" that reverses a string.', expect: 'function reverse' },
  { id: 3, task: 'What is 15 * 37? Reply with only the number.', expected: '555' },
  { id: 4, task: 'List the first 5 prime numbers in order, comma-separated.', expected: '2,3,5,7,11' },
  { id: 5, task: 'Write a one-sentence explanation of what GitHub is.' },
  { id: 6, task: 'Convert "hello" to uppercase. Reply with only the result.', expected: 'HELLO' },
  { id: 7, task: 'What year did World War II end? Reply with only the year.', expected: '1945' },
  { id: 8, task: 'Write a CSS class to make text red and bold.' },
  { id: 9, task: 'What is the chemical symbol for water? Reply with only the symbol.', expected: 'H2O' },
  { id: 10, task: 'Is 101 a prime number? Reply with only "yes" or "no".', expected: 'yes' },
]

async function runAgentTasks() {
  console.log('\n\n')
  console.log('AGENT-LOOP TASK COMPLETION')
  console.log('='.repeat(70))

  const defaultModel = 'llama-3.3-70b-versatile'
  const cfg = PROVIDER_CONFIGS.groq
  if (!cfg.key) {
    console.log('GROQ_API_KEY not configured — cannot run agent tasks.')
    return []
  }

  const url = `${cfg.baseUrl}/chat/completions`
  let passed = 0
  const taskResults = []

  for (const task of AGENT_TASKS) {
    process.stdout.write(`\nTask ${task.id}: ${task.task.slice(0, 60)}... `)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model: defaultModel,
          messages: [{ role: 'user', content: task.task }],
          max_tokens: 100,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        console.log('✘ API error')
        taskResults.push({ ...task, pass: false, error: `HTTP ${response.status}` })
        continue
      }

      const data = await response.json()
      const content = (data.choices?.[0]?.message?.content || '').trim()

      if (!content) {
        console.log('✘ Empty response')
        taskResults.push({ ...task, pass: false, error: 'Empty response', response: '' })
        continue
      }

      let pass = false
      if (task.expected) {
        // For expected answers, check if the response contains the expected text
        pass = content.toLowerCase().includes(task.expected.toLowerCase())
      } else {
        // For generative tasks, check if response is reasonable
        pass = content.length > 10
      }

      console.log(pass ? '✔' : '✘')
      taskResults.push({ ...task, pass, error: pass ? null : `Expected: "${task.expected}", Got: "${content.slice(0, 100)}"`, response: content.slice(0, 200) })
      if (pass) passed++
    } catch (err) {
      console.log('✘ Error')
      taskResults.push({ ...task, pass: false, error: err.message })
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n')
  console.log(`Agent-loop task completion: ${passed}/${AGENT_TASKS.length} tasks completed successfully`)
  for (const r of taskResults) {
    console.log(`  ${r.pass ? '✔' : '✘'} Task ${r.id}: ${r.task.slice(0, 50)}${r.pass ? '' : ` — ${r.error?.slice(0, 80)}`}`)
  }

  return taskResults
}

async function main() {
  await runBenchmarks()
  const taskResults = await runAgentTasks()

  console.log('\n\n')
  console.log('LIMITATIONS')
  console.log('='.repeat(70))
  console.log(`

  This benchmark measures:
  - Raw API response latency for each provider/model (non-streaming, short prompt)
  - Success rate over 3 runs per model
  - Agent-loop task completion on a simple set of 10 factual/generative questions

  This benchmark does NOT measure:
  - Streaming time-to-first-token (all tests use non-streaming for consistency)
  - Response quality or accuracy beyond simple factual checks
  - Performance under load (single concurrent request)
  - Long-context performance (prompt is ~50 tokens)
  - Our API proxy overhead (tests call provider APIs directly)
  - Real-world multi-step agent interactions
  - Time-of-day variation (all tests run in a single session)
  - Provider rate limits or quota exhaustion over extended use
  - Comparison with competitor tools (no benchmark infrastructure)
  - Edge-case handling (malformed input, extreme lengths, etc.)

  These numbers are a snapshot. Real-world performance varies by:
  - Network conditions
  - Provider-side load at time of request
  - Prompt length and complexity
  - Response length
  - Concurrent request volume
  `)
  console.log('\nBenchmark complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
