import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface RiderLocation {
  driverId: string;
  lat: number;
  lng: number;
  timestamp?: string | number;
  routeId?: string;
}

interface AdminState {
  riderLocations: Record<string, RiderLocation>; // driverId → latest location
}

const initialState: AdminState = {
  riderLocations: {},
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    updateRiderLocation(state, action: PayloadAction<RiderLocation>) {
      const { driverId } = action.payload;
      if (!driverId) return;
      state.riderLocations[driverId] = action.payload;
    },
    clearRiderLocations(state) {
      state.riderLocations = {};
    },
  },
});

export const adminActions = adminSlice.actions;
export default adminSlice.reducer;
