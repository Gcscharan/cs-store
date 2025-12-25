import { Payment } from "../../../models/Payment";
import mongoose from "mongoose";

export interface IPaymentRepository {
  deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any>;
}

export class PaymentRepository implements IPaymentRepository {
  async deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await Payment.deleteMany(filter).session(session || null);
  }
}
