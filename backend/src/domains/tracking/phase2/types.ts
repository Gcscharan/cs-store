import type { Marker } from "./privacy";
import type { CustomerCheckpointState, InternalSemanticState } from "./fsm";
import type { MovementConfidence } from "./smoothing";

export type Phase2Enrichment = {
  smoothedLat: number;
  smoothedLng: number;
  movementConfidence: MovementConfidence;
  marker: Marker;
  internalState: InternalSemanticState;
  checkpointState: CustomerCheckpointState;
  nearDestination: boolean;
};
