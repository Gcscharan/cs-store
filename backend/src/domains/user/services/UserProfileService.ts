import { UserRepository } from "../repositories/UserRepository";

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileUpdateData {
  name?: string;
  phone?: string;
  email?: string;
}

export class UserProfileService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        return null;
      }

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAdmin: (user as any).isAdmin || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, updateData: ProfileUpdateData): Promise<any> {
    try {
      const updateObj: any = {};
      if (updateData.name !== undefined) updateObj.name = updateData.name;
      if (updateData.phone !== undefined) updateObj.phone = updateData.phone;
      if (updateData.email !== undefined) updateObj.email = updateData.email;

      const updatedUser = await this.userRepository.findByIdAndUpdate(
        userId,
        updateObj,
        { new: true, runValidators: true, select: "-passwordHash" }
      );

      if (!updatedUser) {
        return null;
      }

      return {
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
        },
      };
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }
}
