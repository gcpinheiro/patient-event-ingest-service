const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
require('reflect-metadata');
const mongoose = require('mongoose');
const { PatientEventSchema } = require('../dist/events/schemas/patient-event.schema');
const { EventsService } = require('../dist/events/events.service');
const { EventWorker } = require('../dist/events/event.worker');

async function main() {
  const connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: `integration_${Date.now()}` }).asPromise();
  const events = connection.model('PatientEvent', PatientEventSchema);
  const service = new EventsService(events);
  let worker;
  try {
    await service.onModuleInit();
    const input = { patientId: 'ordered', type: 'TEST', data: { a: 1, b: 2 }, ts: '2026-11-06T00:00:02Z' };
    const duplicates = await Promise.all(Array.from({ length: 20 }, (_, i) => service.create({ ...input, data: i % 2 ? { b: 2, a: 1 } : input.data })));
    assert.equal(new Set(duplicates.map(x => x.eventId)).size, 1);
    assert.equal(await events.countDocuments(), 1);
    await service.create({ ...input, ts: '2026-11-06T00:00:01Z' });
    await service.create({ ...input, patientId: 'parallel' });
    let active = 0;
    let peak = 0;
    const processor = { async process() { active++; peak = Math.max(peak, active); await delay(100); active--; return { ok: true }; } };
    worker = new EventWorker(events, processor);
    await worker.onModuleInit();
    const until = async (check, timeout = 12000) => { const end = Date.now() + timeout; while (!(await check())) { if (Date.now() > end) throw new Error('Timed out'); await delay(100); } };
    await until(async () => await events.countDocuments({ status: 'processed' }) === 3);
    const ordered = await events.find({ patientId: 'ordered' }).sort({ ts: 1 });
    assert.ok(ordered[0].processedAt < ordered[1].processedAt);
    assert.ok(peak >= 2);
    await worker.onModuleDestroy();
    worker = undefined;
    const expired = await events.create({ patientId: 'recovery', type: 'TEST', data: {}, ts: new Date(), fingerprint: 'c'.repeat(64), status: 'processing', attempts: 1, leaseToken: 'old', leaseUntil: new Date(0) });
    let calls = 0;
    worker = new EventWorker(events, { async process() { if (++calls === 1) throw new Error('simulated failure'); return { recovered: true }; } });
    await worker.onModuleInit();
    await until(async () => (await events.findById(expired._id)).status === 'pending');
    await events.updateOne({ _id: expired._id }, { $set: { nextAttemptAt: new Date(0) } });
    await until(async () => (await events.findById(expired._id)).attempts === 2);
    await events.updateOne({ _id: expired._id }, { $set: { nextAttemptAt: new Date(0) } });
    await until(async () => (await events.findById(expired._id)).status === 'processed');
    const stale = await events.updateOne({ _id: expired._id, leaseToken: 'old', status: 'processing' }, { $set: { status: 'failed' } });
    assert.equal(stale.modifiedCount, 0);
    await events.create({ patientId: 'blocked', type: 'TEST', data: {}, ts: new Date(0), fingerprint: 'd'.repeat(64), status: 'failed' });
    const blocked = await service.create({ ...input, patientId: 'blocked' });
    await delay(600);
    assert.equal((await events.findOne({ eventId: blocked.eventId })).status, 'pending');
    console.log('PASS: concurrent deduplication, ordering, parallelism, lease recovery, retry, stale token, failed predecessor');
  } finally {
    if (worker) await worker.onModuleDestroy();
    await connection.dropDatabase();
    await connection.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
