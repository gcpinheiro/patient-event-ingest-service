import { ValidationPipe, ServiceUnavailableException } from '@nestjs/common';
import { Model } from 'mongoose';
import { CreateEventDto } from './create-event.dto';
import { EventsService } from './events.service';
import { PatientEvent } from './schemas/patient-event.schema';

describe('Event ingestion', () => {
  const payload = {
    patientId: 'P1',
    type: 'UPDATED',
    data: {},
    ts: '2026-11-06T09:00:00Z',
  };
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: CreateEventDto });

  it('accepts the specified payload', async () => {
    await expect(validate(payload)).resolves.toBeInstanceOf(CreateEventDto);
  });

  it.each([
    { ...payload, patientId: ' ' },
    { ...payload, data: [] },
    { ...payload, ts: '2026-02-30T09:00:00Z' },
    { ...payload, ts: '2026-11-06' },
    { ...payload, status: 'processed' },
  ])('rejects invalid or server-owned fields: %j', async (input) => {
    await expect(validate(input)).rejects.toThrow();
  });

  it('waits for persistence before returning acceptance', async () => {
    let finish!: (value: unknown) => void;
    const create = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const service = new EventsService({
      create,
    } as unknown as Model<PatientEvent>);
    let accepted = false;
    const result = service.create(payload).then((value) => {
      accepted = true;
      return value;
    });
    await Promise.resolve();
    expect(accepted).toBe(false);
    finish({ eventId: 'id', status: 'pending' });
    await expect(result).resolves.toEqual({ eventId: 'id', status: 'pending' });
  });

  it('does not acknowledge a failed write', async () => {
    const create = jest.fn().mockRejectedValue(new Error('offline'));
    const service = new EventsService({
      create,
    } as unknown as Model<PatientEvent>);
    await expect(service.create(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
