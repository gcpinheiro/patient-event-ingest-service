import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
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
  providers: [EventsService],
})
export class EventsModule {}
