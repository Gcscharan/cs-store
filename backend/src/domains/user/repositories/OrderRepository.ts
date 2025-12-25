import { Order } from "../../../models/Order";
import mongoose from "mongoose";

export interface IOrderRepository {
  updateMany(filter: any, update: any, options?: any, session?: mongoose.ClientSession): Promise<any>;
}

export class OrderRepository implements IOrderRepository {
  async updateMany(filter: any, update: any, options?: any, session?: mongoose.ClientSession): Promise<any> {
    return await Order.updateMany(filter, update, options || {}).session(session || null);
  }
}
