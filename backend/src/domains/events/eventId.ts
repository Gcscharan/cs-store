import { v5 as uuidv5 } from "uuid";

const NAMESPACE = uuidv5.URL;

export function stableEventId(key: string): string {
  return uuidv5(String(key), NAMESPACE);
}
