import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
})
export class EventsModule {}
