import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness() {
    return { status: 'ok' } as const;
  }

  @Get('ready')
  getReadiness() {
    return this.healthService.checkReadiness();
  }
}
