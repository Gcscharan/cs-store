import Otp from "../../../models/Otp";
import mongoose from "mongoose";

export interface IOtpRepository {
  deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any>;
}

export class OtpRepository implements IOtpRepository {
  async deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await Otp.deleteMany(filter).session(session || null);
  }
}
