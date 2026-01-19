import axios from "axios";
import { API_BASE_URL } from "./runtime";

export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

export default publicApi;
