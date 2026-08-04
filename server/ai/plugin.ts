import type { IncomingMessage, ServerResponse } from 'node:http'
import { Pool } from 'pg'
import type { Plugin } from 'vite'
import { authenticateRoadmapRequest, AuthenticationError } from './auth.ts'
import { createAiConfig } from './config.ts'
import { RoadmapService, RoadmapServiceError } from './service.ts'
import type { GenerationRequest } from './types.ts'
import { VerificationAdminService } from './verificationAdmin.ts'

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

const readJson = async (req: IncomingMessage) => {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 1_000_000) throw new RoadmapServiceError('Request is too large.', 413)
  }
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    throw new RoadmapServiceError('Request body must be valid JSON.')
  }
}

export function aiRoadmapApi(env: Record<string, string | undefined>): Plugin {
  const config = createAiConfig(env)
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  })
  const service = new RoadmapService(pool, config)
  const verificationAdmin = new VerificationAdminService(pool)

  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (
          !url.pathname.startsWith('/api/ai-roadmaps') &&
          !url.pathname.startsWith('/api/verification')
        ) {
          next()
          return
        }
        try {
          const auth = await authenticateRoadmapRequest(req, pool, config)
          if (req.method === 'GET' && url.pathname === '/api/verification') {
            json(res, 200, await verificationAdmin.list(auth))
            return
          }
          const verificationTask = url.pathname.match(
            /^\/api\/verification\/tasks\/([0-9a-f-]+)$/i,
          )
          if (req.method === 'PATCH' && verificationTask) {
            const body = await readJson(req)
            json(
              res,
              200,
              await verificationAdmin.updateTask(auth, verificationTask[1], {
                action: typeof body.action === 'string' ? body.action : undefined,
                status: typeof body.status === 'string' ? body.status : undefined,
                reviewerNotes:
                  typeof body.reviewerNotes === 'string' ? body.reviewerNotes : undefined,
                conflictNotes:
                  typeof body.conflictNotes === 'string' ? body.conflictNotes : undefined,
                resultSourceUrls: Array.isArray(body.resultSourceUrls)
                  ? body.resultSourceUrls.filter(
                      (item): item is string => typeof item === 'string',
                    )
                  : undefined,
              }),
            )
            return
          }
          if (req.method === 'POST' && url.pathname === '/api/verification/programmes') {
            json(res, 200, await verificationAdmin.saveProgramme(auth, await readJson(req)))
            return
          }
          const verificationProgramme = url.pathname.match(
            /^\/api\/verification\/programmes\/([0-9a-f-]+)$/i,
          )
          if (req.method === 'PATCH' && verificationProgramme) {
            const body = await readJson(req)
            json(
              res,
              200,
              await verificationAdmin.reviewProgramme(auth, verificationProgramme[1], {
                status: typeof body.status === 'string' ? body.status : undefined,
                sourceStatus:
                  typeof body.sourceStatus === 'string' ? body.sourceStatus : undefined,
                dataSufficient:
                  typeof body.dataSufficient === 'boolean'
                    ? body.dataSufficient
                    : undefined,
                notes: typeof body.notes === 'string' ? body.notes : undefined,
              }),
            )
            return
          }
          if (req.method === 'GET' && url.pathname === '/api/ai-roadmaps/latest') {
            const studentExternalId = url.searchParams.get('student_external_id') || undefined
            json(res, 200, { generation: await service.latest(auth, studentExternalId) })
            return
          }
          if (req.method === 'POST' && url.pathname === '/api/ai-roadmaps') {
            const body = (await readJson(req)) as GenerationRequest
            json(res, 200, { generation: await service.generate(auth, body) })
            return
          }
          const match = url.pathname.match(/^\/api\/ai-roadmaps\/([0-9a-f-]+)$/i)
          if (req.method === 'PATCH' && match) {
            const body = await readJson(req)
            json(res, 200, {
              generation: await service.update(auth, match[1], {
                status: typeof body.status === 'string' ? body.status : undefined,
                counsellorNotes:
                  typeof body.counsellorNotes === 'string' ? body.counsellorNotes : undefined,
                roadmap: body.roadmap,
              }),
            })
            return
          }
          json(res, 404, { error: 'Roadmap endpoint not found.' })
        } catch (error) {
          const known =
            error instanceof AuthenticationError || error instanceof RoadmapServiceError
          json(res, known ? error.statusCode : 500, {
            error: known
              ? error.message
              : 'We could not process the roadmap request. Your saved data is unchanged.',
          })
        }
  }

  return {
    name: 'manyfolds-ai-roadmap-api',
    configureServer(server) {
      server.middlewares.use(middleware)
      server.httpServer?.once('close', () => {
        void pool.end()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
