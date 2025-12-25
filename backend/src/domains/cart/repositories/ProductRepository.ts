import { Product } from "../../../models/Product";

export interface IProductRepository {
  findById(productId: string): Promise<any>;
}

export class ProductRepository implements IProductRepository {
  async findById(productId: string): Promise<any> {
    return await Product.findById(productId);
  }
}
