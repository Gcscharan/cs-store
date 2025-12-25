import Notification from "../../../models/Notification";
import mongoose from "mongoose";

export interface INotificationRepository {
  deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any>;
}

export class NotificationRepository implements INotificationRepository {
  async deleteMany(filter: any, session?: mongoose.ClientSession): Promise<any> {
    return await Notification.deleteMany(filter).session(session || null);
  }
}
