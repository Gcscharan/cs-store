"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPincode = void 0;
const Pincode_1 = require("../models/Pincode");
const checkPincode = async (req, res) => {
    try {
        const { pincode } = req.params;
        const pincodeData = await Pincode_1.Pincode.findOne({ pincode });
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to check pincode" });
    }
};
exports.checkPincode = checkPincode;
//# sourceMappingURL=pincodeController.js.map