import {
  IsISO8601,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(256)
  patientId!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(256)
  type!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  ts!: string;
}
