import { Request, Response } from "express";
import { User } from "../../../models/User";
import Otp from "../../../models/Otp";

export const verifyMobileOTP = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    const record = await Otp.findOne({ phone });
    if (!record) {
      return res.status(400).json({ message: "OTP not found" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    await User.updateOne(
      { phone },
      { mobileVerified: true }
    );

    await Otp.deleteOne({ phone });

    return res.status(200).json({ message: "Mobile verification successful" });
  } catch (error: any) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
