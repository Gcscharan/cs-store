/**
 * Experiment API Client
 * 
 * Fetches A/B testing experiment configuration from backend
 */

import { baseApi } from './baseApi';

export interface ExperimentConfig {
  experimentName: string;
  variant: string;
  config: {
    threshold?: number;
    [key: string]: any;
  };
}

export const experimentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExperimentConfig: builder.query<ExperimentConfig | null, string>({
      query: (userId) => `/experiments/config?userId=${userId}`,
      transformResponse: (response: { success: boolean; config: ExperimentConfig | null }) => {
        return response.config;
      },
    }),
  }),
  overrideExisting: false,
});

export const { useGetExperimentConfigQuery, useLazyGetExperimentConfigQuery } = experimentApi;
