import { Request, Response } from "express";
import { Pincode } from "../models/Pincode";

export const checkPincode = async (req: Request, res: Response) => {
  try {
    const { pincode } = req.params;

    const pincodeData = await Pincode.findOne({ pincode });

    if (!pincodeData) {
      return res.json({
        serviceable: false,
        message: "Unable to deliver to this location.",
      });
    }

    res.json({
      serviceable: true,
      state: pincodeData.state,
      district: pincodeData.district,
      taluka: pincodeData.taluka,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to check pincode" });
  }
};
