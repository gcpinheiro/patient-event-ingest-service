import {
  OnModuleInit,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEventDto } from './create-event.dto';
import { PatientEvent } from './schemas/patient-event.schema';
import { fingerprint as hashPayload } from './fingerprint';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @InjectModel(PatientEvent.name)
    private readonly events: Model<PatientEvent>,
  ) {}

  async onModuleInit() {
    await this.events.init();
  }

  async create(input: CreateEventDto) {
    const payload = {
      patientId: input.patientId.trim(),
      type: input.type.trim(),
      data: input.data,
      ts: new Date(input.ts),
    };
    const fingerprint = hashPayload({
      ...payload,
      ts: payload.ts.toISOString(),
    });
    try {
      const event = await this.events.create({ ...payload, fingerprint });
      return { eventId: event.eventId, status: event.status };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        const existing = await this.events.findOne({ fingerprint }).exec();
        if (existing)
          return { eventId: existing.eventId, status: existing.status };
      }
      throw new ServiceUnavailableException(
        'Event could not be persisted; retry later',
      );
    }
  }
}
