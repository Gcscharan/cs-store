/**
 * Unit tests for getAuditLogsForOrder
 *
 * Requirements: 6.5, 6.6
 */

jest.mock('../../../models/ReconciliationAuditLog');

import mongoose from 'mongoose';
import { ReconciliationAuditLog } from '../../../models/ReconciliationAuditLog';
import { getAuditLogsForOrder } from '../reconciliationReportService';

const mockFind = ReconciliationAuditLog.find as jest.MockedFunction<typeof ReconciliationAuditLog.find>;

const makeChain = (docs: any[]) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(docs),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockReturnValue(makeChain([]) as any);
});

describe('getAuditLogsForOrder', () => {
  it('returns entries in reverse-chronological order (sort by recordedAt -1)', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const docs = [
      { _id: new mongoose.Types.ObjectId(), recordedAt: new Date('2024-01-15T10:00:00Z') },
      { _id: new mongoose.Types.ObjectId(), recordedAt: new Date('2024-01-15T09:00:00Z') },
    ];
    mockFind.mockReturnValue(makeChain(docs) as any);

    const result = await getAuditLogsForOrder(orderId.toString());

    expect(mockFind).toHaveBeenCalledWith({ orderId: expect.any(mongoose.Types.ObjectId) });
    const chain = mockFind.mock.results[0].value;
    expect(chain.sort).toHaveBeenCalledWith({ recordedAt: -1 });
    expect(result).toEqual(docs);
  });

  it('returns empty array for an invalid ObjectId string without throwing', async () => {
    const result = await getAuditLogsForOrder('not-a-valid-objectid');

    expect(result).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns empty array for an empty string without throwing', async () => {
    const result = await getAuditLogsForOrder('');

    expect(result).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('respects the limit parameter', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const chain = makeChain([]);
    mockFind.mockReturnValue(chain as any);

    await getAuditLogsForOrder(orderId.toString(), 10);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('uses default limit of 50 when not specified', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const chain = makeChain([]);
    mockFind.mockReturnValue(chain as any);

    await getAuditLogsForOrder(orderId.toString());

    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('returns empty array when no entries exist for the order', async () => {
    const orderId = new mongoose.Types.ObjectId();
    mockFind.mockReturnValue(makeChain([]) as any);

    const result = await getAuditLogsForOrder(orderId.toString());

    expect(result).toEqual([]);
  });

  it('queries by the correct orderId ObjectId', async () => {
    const orderId = new mongoose.Types.ObjectId();
    mockFind.mockReturnValue(makeChain([]) as any);

    await getAuditLogsForOrder(orderId.toString());

    expect(mockFind).toHaveBeenCalledWith({
      orderId: expect.objectContaining({ toString: expect.any(Function) }),
    });

    const calledWith = (mockFind.mock.calls[0][0] as any).orderId;
    expect(calledWith.toString()).toBe(orderId.toString());
  });
});
