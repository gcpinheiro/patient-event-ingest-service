import { Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

@Injectable()
export class EventProcessor {
  async process(): Promise<Record<string, unknown>> {
    await delay(5000);
    return { simulated: true };
  }
}
