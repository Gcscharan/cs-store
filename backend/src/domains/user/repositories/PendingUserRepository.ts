import { PendingUser } from "../../../models/PendingUser";
import mongoose from "mongoose";

export interface IPendingUserRepository {
  findOne(filter: any, session?: mongoose.ClientSession): Promise<any>;
  deleteOne(filter: any, session?: mongoose.ClientSession): Promise<any>;
}

export class PendingUserRepository implements IPendingUserRepository {
  async findOne(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await PendingUser.findOne(filter).session(session || null);
  }

  async deleteOne(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await PendingUser.deleteOne(filter).session(session || null);
  }
}
