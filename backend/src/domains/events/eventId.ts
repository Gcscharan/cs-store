import { v4 as uuidv4 } from "uuid";

export function stableEventId(key: string): string {
  return uuidv4();
}
