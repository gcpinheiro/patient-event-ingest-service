import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async checkReadiness() {
    try {
      if (
        this.connection.readyState !== ConnectionStates.connected ||
        !this.connection.db
      ) {
        throw new Error('MongoDB connection is not ready');
      }

      await this.connection.db.admin().ping();

      return {
        dependencies: { mongodb: 'up' },
        status: 'ready',
      } as const;
    } catch {
      throw new ServiceUnavailableException({
        dependencies: { mongodb: 'down' },
        status: 'not_ready',
      });
    }
  }
}
