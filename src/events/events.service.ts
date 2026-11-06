import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEventDto } from './create-event.dto';
import { PatientEvent } from './schemas/patient-event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(PatientEvent.name)
    private readonly events: Model<PatientEvent>,
  ) {}

  async create(input: CreateEventDto) {
    const payload = {
      patientId: input.patientId.trim(),
      type: input.type.trim(),
      data: input.data,
      ts: new Date(input.ts),
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    try {
      const event = await this.events.create({ ...payload, fingerprint });
      return { eventId: event.eventId, status: event.status };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        throw new ConflictException('Event already exists');
      }
      throw new ServiceUnavailableException(
        'Event could not be persisted; retry later',
      );
    }
  }
}
