import { Cart } from "../../../models/Cart";
import mongoose from "mongoose";

export interface ICartRepository {
  deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any>;
}

export class CartRepository implements ICartRepository {
  async deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await Cart.deleteMany(filter).session(session || null);
  }
}
