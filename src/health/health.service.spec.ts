import { ServiceUnavailableException } from '@nestjs/common';
import { Connection, ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ready when MongoDB responds to a ping', async () => {
    const ping = jest.fn().mockResolvedValue({ ok: 1 });
    const connection = {
      db: { admin: () => ({ ping }) },
      readyState: ConnectionStates.connected,
    } as unknown as Connection;
    const service = new HealthService(connection);

    await expect(service.checkReadiness()).resolves.toEqual({
      dependencies: { mongodb: 'up' },
      status: 'ready',
    });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable when MongoDB is disconnected', async () => {
    const connection = {
      db: undefined,
      readyState: ConnectionStates.disconnected,
    } as unknown as Connection;
    const service = new HealthService(connection);

    await expect(service.checkReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
