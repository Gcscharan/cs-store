import { Request, Response } from "express";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";

/**
 * Delivery Boy Signup
 * POST /api/delivery/auth/signup
 */
export const deliverySignup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      password,
      vehicleType,
      assignedAreas,
      aadharOrId,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !vehicleType) {
      res.status(400).json({
        error: "Name, email, phone, password, and vehicle type are required",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      res.status(400).json({
        error: "User with this email or phone already exists",
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with delivery role and pending status
    const user = new User({
      name,
      email,
      phone,
      passwordHash,
      role: "delivery",
      status: "pending", // Requires admin approval
      deliveryProfile: {
        phone,
        vehicleType,
        assignedAreas: assignedAreas || [],
        aadharOrId,
        documents: [],
      },
    });

    await user.save();

    // Create corresponding DeliveryBoy record
    const deliveryBoy = new DeliveryBoy({
      name,
      phone,
      email,
      userId: user._id,
      vehicleType,
      isActive: false, // Inactive until approved
      availability: "offline",
      currentLocation: {
        lat: 0,
        lng: 0,
        lastUpdatedAt: new Date(),
      },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    });

    await deliveryBoy.save();

    // TODO: Send notification to admin about new signup
    // You can implement email/push notification here

    res.status(201).json({
      success: true,
      message:
        "Account submitted for approval. Admin will activate your account.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Delivery signup error:", error);
    res.status(500).json({
      error: "Failed to create delivery account. Please try again later.",
    });
  }
};

/**
 * Delivery Boy Login
 * POST /api/delivery/auth/login
 */
export const deliveryLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: "Email and password are required",
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({
        error: "Invalid email or password",
      });
      return;
    }

    // Check if user has delivery role
    if (user.role !== "delivery") {
      res.status(403).json({
        error: "Unauthorized. This login is for delivery partners only.",
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: "Invalid email or password",
      });
      return;
    }

    // Check approval status
    if (user.status === "pending") {
      res.status(403).json({
        error: "Your account is awaiting admin approval.",
        status: "pending",
      });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({
        error: "Your account has been suspended. Please contact support.",
        status: "suspended",
      });
      return;
    }

    // Get delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

    if (!deliveryBoy) {
      res.status(404).json({
        error: "Delivery profile not found",
      });
      return;
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        status: user.status,
        deliveryBoyId: deliveryBoy._id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      tokens: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        vehicleType: deliveryBoy.vehicleType,
        availability: deliveryBoy.availability,
        earnings: deliveryBoy.earnings,
        completedOrdersCount: deliveryBoy.completedOrdersCount,
      },
    });
  } catch (error) {
    console.error("Delivery login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again later.",
    });
  }
};

/**
 * Get Delivery Boy Profile
 * GET /api/delivery/auth/profile
 */
export const getDeliveryProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

    // Auto-create DeliveryBoy record if it doesn't exist for a delivery user
    if (!deliveryBoy) {
      const userDetails = await User.findById(user._id);
      
      if (!userDetails) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Create a new DeliveryBoy record for this user
      deliveryBoy = new DeliveryBoy({
        name: userDetails.name,
        phone: userDetails.phone,
        email: userDetails.email,
        userId: user._id,
        vehicleType: userDetails.deliveryProfile?.vehicleType || 'bike',
        isActive: userDetails.status === 'active',
        availability: 'offline',
        currentLocation: {
          lat: 0,
          lng: 0,
          lastUpdatedAt: new Date(),
        },
        earnings: 0,
        completedOrdersCount: 0,
        assignedOrders: [],
      });

      await deliveryBoy.save();
      console.log(`✅ Auto-created DeliveryBoy record for user ${user._id}`);
    }

    const userDetails = await User.findById(user._id).select(
      "-passwordHash"
    );

    // Return a flat structure that matches frontend expectations
    res.json({
      id: userDetails?._id || deliveryBoy._id,
      name: deliveryBoy.name,
      email: deliveryBoy.email,
      phone: deliveryBoy.phone,
      role: userDetails?.role || "delivery",
      createdAt: userDetails?.createdAt || deliveryBoy.createdAt,
      updatedAt: userDetails?.updatedAt || deliveryBoy.updatedAt,
      vehicleType: deliveryBoy.vehicleType,
      availability: deliveryBoy.availability,
      isActive: deliveryBoy.isActive,
      currentLocation: deliveryBoy.currentLocation,
      earnings: deliveryBoy.earnings,
      completedOrdersCount: deliveryBoy.completedOrdersCount,
      assignedOrders: deliveryBoy.assignedOrders,
      selfieUrl: deliveryBoy.selfieUrl,
      deId: deliveryBoy._id,
    });
  } catch (error) {
    console.error("Get delivery profile error:", error);
    res.status(500).json({
      error: "Failed to get profile. Please try again later.",
    });
  }
};

/**
 * Update Delivery Boy Profile
 * PUT /api/delivery/profile
 */
export const updateDeliveryProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

    // Auto-create if doesn't exist
    if (!deliveryBoy) {
      const userDetails = await User.findById(user._id);
      if (userDetails) {
        deliveryBoy = new DeliveryBoy({
          name: userDetails.name,
          phone: userDetails.phone,
          email: userDetails.email,
          userId: user._id,
          vehicleType: userDetails.deliveryProfile?.vehicleType || 'bike',
          isActive: userDetails.status === 'active',
          availability: 'offline',
          currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
          earnings: 0,
          completedOrdersCount: 0,
          assignedOrders: [],
        });
        await deliveryBoy.save();
      } else {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    // Update fields from request body
    const allowedUpdates = ['name', 'phone', 'vehicleType', 'email'];
    const updates: any = {};
    
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Update DeliveryBoy document
    Object.assign(deliveryBoy, updates);
    await deliveryBoy.save();

    // Also update User document if name, email, or phone changed
    if (updates.name || updates.email || updates.phone) {
      const userDoc = await User.findById(user._id);
      if (userDoc) {
        if (updates.name) userDoc.name = updates.name;
        if (updates.email) userDoc.email = updates.email;
        if (updates.phone) userDoc.phone = updates.phone;
        await userDoc.save();
      }
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        email: deliveryBoy.email,
        vehicleType: deliveryBoy.vehicleType,
        availability: deliveryBoy.availability,
        isActive: deliveryBoy.isActive,
        selfieUrl: deliveryBoy.selfieUrl,
      },
    });
  } catch (error) {
    console.error("Update delivery profile error:", error);
    res.status(500).json({
      error: "Failed to update profile. Please try again later.",
    });
  }
};

/**
 * Get Selfie URL
 * GET /api/delivery/selfie-url
 */
export const getSelfieUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    let deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

    // Auto-create if doesn't exist
    if (!deliveryBoy) {
      const userDetails = await User.findById(user._id);
      if (userDetails) {
        deliveryBoy = new DeliveryBoy({
          name: userDetails.name,
          phone: userDetails.phone,
          email: userDetails.email,
          userId: user._id,
          vehicleType: userDetails.deliveryProfile?.vehicleType || 'bike',
          isActive: userDetails.status === 'active',
          availability: 'offline',
          currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
          earnings: 0,
          completedOrdersCount: 0,
          assignedOrders: [],
        });
        await deliveryBoy.save();
      } else {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    res.json({
      success: true,
      selfieUrl: deliveryBoy.selfieUrl || null,
    });
  } catch (error) {
    console.error("Get selfie URL error:", error);
    res.status(500).json({
      error: "Failed to get selfie URL. Please try again later.",
    });
  }
};

/**
 * Update Selfie
 * PUT /api/delivery/update-selfie
 */
export const updateSelfie = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { selfieUrl } = req.body;

    if (!selfieUrl) {
      res.status(400).json({ error: "Selfie URL is required" });
      return;
    }

    let deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });

    // Auto-create if doesn't exist
    if (!deliveryBoy) {
      const userDetails = await User.findById(user._id);
      if (userDetails) {
        deliveryBoy = new DeliveryBoy({
          name: userDetails.name,
          phone: userDetails.phone,
          email: userDetails.email,
          userId: user._id,
          vehicleType: userDetails.deliveryProfile?.vehicleType || 'bike',
          isActive: userDetails.status === 'active',
          availability: 'offline',
          currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
          earnings: 0,
          completedOrdersCount: 0,
          assignedOrders: [],
        });
        await deliveryBoy.save();
      } else {
        res.status(404).json({ error: "User not found" });
        return;
      }
    }

    deliveryBoy.selfieUrl = selfieUrl;
    await deliveryBoy.save();

    res.json({
      success: true,
      message: "Selfie updated successfully",
      selfieUrl: deliveryBoy.selfieUrl,
    });
  } catch (error) {
    console.error("Update selfie error:", error);
    res.status(500).json({
      error: "Failed to update selfie. Please try again later.",
    });
  }
};
