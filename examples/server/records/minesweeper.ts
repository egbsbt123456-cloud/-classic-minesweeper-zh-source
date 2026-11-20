import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { sessionUser } from '../auth/session.js';
const setup = z.object({ runId: z.uuid(), difficulty: z.enum(['beginner','intermediate','expert','custom','screen']), width: z.number().int().min(9).max(60), height: z.number().int().min(9).max(40), mines: z.number().int().min(10).max(2399) }).strict().superRefine((v, ctx) => {
  if (v.mines >= v.width*v.height) ctx.addIssue({ code:'custom', message:'Too many mines' });
  const fixed = { beginner: [9,9,10], intermediate: [16,16,40], expert: [30,16,99] };
  const expected = fixed[v.difficulty as keyof typeof fixed];
  if (expected && [v.width,v.height,v.mines].some((n,i) => n !== expected[i])) ctx.addIssue({code:'custom',message:'Difficulty mismatch'});
});
const completion = z.object({ elapsedMs: z.number().int().min(0).max(7*86400000), assisted: z.boolean() }).strict();
export function registerMinesweeperRecords(app: FastifyInstance, db: Database.Database, origin: string, production: boolean) {
  const enabled = !production || origin.startsWith('https://');
  app.get('/api/me/minesweeper/records', (req, reply) => {
    const user=sessionUser(db,req.headers.cookie); if (!user) return reply.code(401).send({error:'请先登录查看自己的通关记录'});
    const parsed=z.object({before:z.coerce.number().int().positive().optional()}).strict().safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({error:'分页参数不正确'});
    const rows=db.prepare('SELECT id,run_id AS runId,difficulty,width,height,mines,elapsed_ms AS elapsedMs,completed_at AS completedAt,assisted FROM minesweeper_runs WHERE user_id=? AND completed_at IS NOT NULL AND id<? ORDER BY id DESC LIMIT 21').all(user.id,parsed.data.before ?? Number.MAX_SAFE_INTEGER) as {id:number}[];
    const page=rows.slice(0,20);
    const total=(db.prepare('SELECT count(*) AS total FROM minesweeper_runs WHERE user_id=? AND completed_at IS NOT NULL').get(user.id) as {total:number}).total;
    return { records:page, total, nextBefore:rows.length>20 ? page.at(-1)!.id : null, source:'client-reported-singleplayer' };
  });
  app.post('/api/me/minesweeper/runs', (req,reply) => {
    if (!enabled) return reply.code(503).send({error:'保存账号记录需要 HTTPS'});
    if (req.headers.origin !== origin) return reply.code(403).send({error:'请求来源不允许'});
    const user=sessionUser(db,req.headers.cookie); if (!user) return reply.code(401).send({error:'游客可以游玩，登录后才能保存账号记录'});
    const parsed=setup.safeParse(req.body); if (!parsed.success) return reply.code(400).send({error:'棋盘参数不正确'});
    const v=parsed.data;
    const previous=db.prepare('SELECT user_id,width,height,mines,difficulty FROM minesweeper_runs WHERE run_id=?').get(v.runId) as {user_id:string;width:number;height:number;mines:number;difficulty:string}|undefined;
    if (previous) return previous.user_id===user.id && previous.width===v.width && previous.height===v.height && previous.mines===v.mines && previous.difficulty===v.difficulty ? {runId:v.runId} : reply.code(409).send({error:'该局不能重复创建或转移账号'});
    const count=(db.prepare('SELECT count(*) AS n FROM minesweeper_runs WHERE user_id=? AND started_at>?').get(user.id,Date.now()-3600000) as {n:number}).n;
    if (count>=120) return reply.code(429).send({error:'开局过于频繁，请稍后再试'});
    db.prepare('DELETE FROM minesweeper_runs WHERE completed_at IS NULL AND started_at<?').run(Date.now()-30*86400000);
    db.prepare('INSERT INTO minesweeper_runs (run_id,user_id,difficulty,width,height,mines,started_at) VALUES (?,?,?,?,?,?,?)').run(v.runId,user.id,v.difficulty,v.width,v.height,v.mines,Date.now());
    return reply.code(201).send({runId:v.runId});
  });
  app.post('/api/me/minesweeper/runs/:runId/complete', (req,reply) => {
    if (!enabled) return reply.code(503).send({error:'保存账号记录需要 HTTPS'});
    if (req.headers.origin !== origin) return reply.code(403).send({error:'请求来源不允许'});
    const user=sessionUser(db,req.headers.cookie); if (!user) return reply.code(401).send({error:'登录已失效，本局未保存'});
    const params=z.object({runId:z.uuid()}).safeParse(req.params); const body=completion.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({error:'通关参数不正确'});
    const run=db.prepare('SELECT * FROM minesweeper_runs WHERE run_id=? AND user_id=?').get(params.data.runId,user.id) as {completed_at:number|null;elapsed_ms:number;assisted:number}|undefined;
    if (!run) return reply.code(404).send({error:'找不到属于当前账号的这局游戏，请重新开局'});
    if (run.completed_at !== null && (run.elapsed_ms!==body.data.elapsedMs || Boolean(run.assisted)!==body.data.assisted)) return reply.code(409).send({error:'已保存的通关记录不能改写'});
    if (run.completed_at === null) db.prepare('UPDATE minesweeper_runs SET completed_at=?,elapsed_ms=?,assisted=? WHERE run_id=? AND user_id=? AND completed_at IS NULL').run(Date.now(),body.data.elapsedMs,Number(body.data.assisted),params.data.runId,user.id);
    return {saved:true};
  });
}
