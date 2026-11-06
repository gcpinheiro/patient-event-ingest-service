import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventWorker } from './event.worker';
import { EventProcessor } from './event.processor';
import {
  PatientEvent,
  PatientEventSchema,
} from './schemas/patient-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatientEvent.name, schema: PatientEventSchema },
    ]),
  ],
  exports: [MongooseModule],
  controllers: [EventsController],
  providers: [EventsService, EventWorker, EventProcessor],
})
export class EventsModule {}
