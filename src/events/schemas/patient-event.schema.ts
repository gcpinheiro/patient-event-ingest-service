import { randomUUID } from 'node:crypto';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { EventStatus } from '../event-status.enum';

export type PatientEventDocument = HydratedDocument<PatientEvent>;

@Schema({
  collection: 'patient_events',
  timestamps: true,
  versionKey: false,
})
export class PatientEvent {
  @Prop({ default: randomUUID, immutable: true, required: true })
  eventId!: string;

  @Prop({ required: true, trim: true })
  patientId!: string;

  @Prop({ required: true, trim: true })
  type!: string;

  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  data!: Record<string, unknown>;

  @Prop({ required: true, type: Date })
  ts!: Date;

  @Prop({ immutable: true, match: /^[a-f0-9]{64}$/, required: true })
  fingerprint!: string;

  @Prop({
    default: EventStatus.Pending,
    enum: Object.values(EventStatus),
    required: true,
    type: String,
  })
  status!: EventStatus;

  @Prop({ default: 0, min: 0, required: true })
  attempts!: number;

  @Prop({ default: null, type: Date })
  leaseUntil!: Date | null;

  @Prop({ default: null, type: String })
  error!: string | null;

  createdAt!: Date;

  updatedAt!: Date;
}

export const PatientEventSchema = SchemaFactory.createForClass(PatientEvent);

PatientEventSchema.index(
  { eventId: 1 },
  { name: 'uniq_event_id', unique: true },
);
PatientEventSchema.index(
  { fingerprint: 1 },
  { name: 'uniq_event_fingerprint', unique: true },
);
PatientEventSchema.index(
  { patientId: 1, ts: 1 },
  { name: 'patient_event_order' },
);
PatientEventSchema.index(
  { status: 1, leaseUntil: 1 },
  { name: 'worker_claim' },
);
