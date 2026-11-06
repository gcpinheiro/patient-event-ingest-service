import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { PatientEvent } from './schemas/patient-event.schema';
import { EventStatus } from './event-status.enum';

@Injectable()
export class EventWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventWorker.name);
  private stopped = false;
  private loop?: Promise<void>;
  private readonly active = new Map<string, Promise<void>>();
  private readonly concurrency = Number(process.env.WORKER_CONCURRENCY ?? 100);

  constructor(
    @InjectModel(PatientEvent.name)
    private readonly events: Model<PatientEvent>,
  ) {}

  async onModuleInit() {
    await this.events.init();
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1)
      throw new Error('WORKER_CONCURRENCY must be a positive integer');
    if (process.env.WORKER_ENABLED !== 'false') this.loop = this.run();
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.loop;
    await Promise.all(this.active.values());
  }

  private async run() {
    while (!this.stopped) {
      try {
        const patients = await this.events.distinct('patientId', {
          status: { $in: [EventStatus.Pending, EventStatus.Processing] },
        });
        for (const patientId of patients) {
          if (this.stopped || this.active.size >= this.concurrency) break;
          if (this.active.has(patientId)) continue;
          const task = this.processPatient(patientId)
            .catch(() => this.logger.error('Worker database operation failed'))
            .finally(() => this.active.delete(patientId));
          this.active.set(patientId, task);
        }
      } catch {
        this.logger.error('Worker polling failed; will retry');
      }
      await delay(250);
    }
  }

  private async processPatient(patientId: string) {
    const first = await this.events
      .findOne({ patientId, status: { $ne: EventStatus.Processed } })
      .sort({ ts: 1, _id: 1 })
      .exec();
    if (!first || first.status !== EventStatus.Pending) return;
    const token = randomUUID();
    const event = await this.events
      .findOneAndUpdate(
        { _id: first._id, status: EventStatus.Pending },
        {
          $set: {
            status: EventStatus.Processing,
            leaseUntil: new Date(Date.now() + 60000),
            leaseToken: token,
          },
          $inc: { attempts: 1 },
        },
        { new: true },
      )
      .exec();
    if (!event) return;
    await delay(5000);
    await this.events
      .updateOne(
        { _id: event._id, status: EventStatus.Processing, leaseToken: token },
        {
          $set: {
            status: EventStatus.Processed,
            processedAt: new Date(),
            result: { simulated: true },
            leaseUntil: null,
            leaseToken: null,
            error: null,
          },
        },
      )
      .exec();
  }
}
