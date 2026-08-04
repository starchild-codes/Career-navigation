import type { AiConfig } from './config.ts'
import { OpenRouterError } from './openrouter.ts'
import { ROADMAP_SYSTEM_PROMPT } from './prompt.ts'
import { ROADMAP_JSON_SCHEMA } from './schema.ts'
import type { GenerationUsage, RoadmapEvidencePackage } from './types.ts'

type ProviderResponse = {
  model?: string
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    cost?: number
    completion_tokens_details?: { reasoning_tokens?: number }
    reasoning_tokens?: number
  }
}

const contentText = (content: string | Array<{ text?: string }> | undefined) => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('')
  return ''
}

export async function callOpenRouterForEvaluation(
  config: AiConfig,
  model: string,
  evidence: RoadmapEvidencePackage,
  maxOutputTokens: number,
  supportsReasoning: boolean,
): Promise<{ rawContent: string; modelUsed: string; usage: GenerationUsage; latencyMs: number }> {
  if (!config.apiKey) throw new OpenRouterError('OPENROUTER_API_KEY is required.')
  const started = Date.now()
  let response: Response
  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: ROADMAP_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(evidence) },
      ],
      temperature: 0.1,
      max_tokens: maxOutputTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'manyfolds_roadmap', strict: true, schema: ROADMAP_JSON_SCHEMA },
      },
      provider: { require_parameters: true },
    }
    if (supportsReasoning) body.reasoning = { effort: 'low', exclude: true }
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://manyfolds.app',
        'X-Title': 'Manyfolds evaluation',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new OpenRouterError('Evaluation provider request failed.', true)
  }
  if (!response.ok) {
    throw new OpenRouterError(
      `Evaluation provider returned ${response.status}.`,
      response.status === 408 || response.status === 429 || response.status >= 500,
      response.status,
    )
  }
  const payload = (await response.json()) as ProviderResponse
  const rawContent = contentText(payload.choices?.[0]?.message?.content)
  if (!rawContent) throw new OpenRouterError('Evaluation provider returned an empty response.', true)
  const inputTokens = payload.usage?.prompt_tokens || 0
  const outputTokens = payload.usage?.completion_tokens || 0
  const reasoningTokens =
    payload.usage?.completion_tokens_details?.reasoning_tokens || payload.usage?.reasoning_tokens || 0
  return {
    rawContent,
    modelUsed: payload.model || model,
    latencyMs: Date.now() - started,
    usage: {
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens: Math.max(payload.usage?.total_tokens || 0, inputTokens + outputTokens + reasoningTokens),
      reportedCost: typeof payload.usage?.cost === 'number' ? payload.usage.cost : null,
    },
  }
}
