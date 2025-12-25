import { User } from "../../../models/User";
import mongoose from "mongoose";

export interface IUserRepository {
  findById(userId: string, session?: mongoose.ClientSession): Promise<any>;
  findByIdAndUpdate(userId: string, updateData: any, options: any, session?: mongoose.ClientSession): Promise<any>;
  findByIdAndDelete(userId: string, session?: mongoose.ClientSession): Promise<any>;
  save(user: any, session?: mongoose.ClientSession): Promise<any>;
}

export class UserRepository implements IUserRepository {
  async findById(userId: string, session?: mongoose.ClientSession): Promise<any> {
    return await User.findById(userId).session(session || null);
  }

  async findByIdAndUpdate(userId: string, updateData: any, options: any, session?: mongoose.ClientSession): Promise<any> {
    return await User.findByIdAndUpdate(userId, updateData, options).session(session || null);
  }

  async findByIdAndDelete(userId: string, session?: mongoose.ClientSession): Promise<any> {
    return await User.findByIdAndDelete(userId).session(session || null);
  }

  async save(user: any, session?: mongoose.ClientSession): Promise<any> {
    return await user.save({ session: session || null });
  }
}
