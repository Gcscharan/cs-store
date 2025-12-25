import { Product } from "../../../models/Product";

export class ProductSearchRepository {
  async aggregate(pipeline: any[]): Promise<any[]> {
    return Product.aggregate(pipeline);
  }

  async find(query: any, projection?: any, options?: { limit?: number; skip?: number; sort?: any; lean?: boolean }): Promise<any[]> {
    let q: any = Product.find(query, projection) as any;
    if (options?.sort) q = q.sort(options.sort as any);
    if (typeof options?.skip === 'number') q = q.skip(options.skip);
    if (typeof options?.limit === 'number') q = q.limit(options.limit);
    if (options?.lean !== false) q = q.lean();
    const res = await q.exec();
    return res as unknown as any[];
  }

  async countDocuments(query: any): Promise<number> {
    return Product.countDocuments(query).exec();
  }
}
