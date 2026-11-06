import { model } from 'mongoose';
import { EventStatus } from '../event-status.enum';
import { PatientEvent, PatientEventSchema } from './patient-event.schema';

describe('PatientEventSchema', () => {
  const PatientEventModel = model<PatientEvent>(
    'PatientEventSchemaTest',
    PatientEventSchema,
  );

  it('uses safe defaults for a newly ingested event', () => {
    const event = new PatientEventModel({
      data: { dosage: '10mg' },
      fingerprint: 'a'.repeat(64),
      patientId: 'PAT-123',
      ts: new Date('2026-11-06T09:15:00.000Z'),
      type: 'MEDICATION_UPDATED',
    });

    expect(event.validateSync()).toBeUndefined();
    expect(event.eventId).toEqual(expect.any(String));
    expect(event.status).toBe(EventStatus.Pending);
    expect(event.attempts).toBe(0);
    expect(event.leaseUntil).toBeNull();
    expect(event.error).toBeNull();
  });

  it('rejects an invalid fingerprint', () => {
    const event = new PatientEventModel({
      data: {},
      fingerprint: 'not-a-sha256',
      patientId: 'PAT-123',
      ts: new Date(),
      type: 'PATIENT_UPDATED',
    });

    expect(event.validateSync()?.errors.fingerprint).toBeDefined();
  });

  it('declares the indexes needed for idempotency and worker queries', () => {
    const indexes = PatientEventSchema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ eventId: 1 }, expect.objectContaining({ unique: true })],
        [{ fingerprint: 1 }, expect.objectContaining({ unique: true })],
        [{ patientId: 1, ts: 1 }, expect.any(Object)],
        [{ status: 1, leaseUntil: 1 }, expect.any(Object)],
      ]),
    );
  });
});
