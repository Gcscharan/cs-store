/**
 * Experiment Hardening Validation Tests
 * 
 * Task 12: Validate A/B Testing Hardening
 * 
 * This test suite validates that all hardening checks work correctly:
 * 1. SRM detection (Sample Ratio Mismatch)
 * 2. Minimum sample size enforcement
 * 3. Guardrail monitoring
 * 4. Statistical significance
 * 5. Auto-winner detection and deployment
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Experiment from '../models/Experiment';
import VoiceMetrics from '../models/VoiceMetrics';
import {
  checkSRM,
  checkMinimumSampleSize,
  checkGuardrails,
  checkStatisticalSignificance,
  detectWinner,
} from '../services/experimentHardeningService';
import {
  getExperimentResults,
  autoStopIfGuardrailsViolated,
  autoDeployWinnerIfDetected,
} from '../services/experimentService';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Use the existing mongoose connection from global setup
  // Do NOT create a new MongoMemoryServer or call mongoose.connect()
});

afterAll(async () => {
  // Cleanup is handled by global setup
  // Do NOT disconnect mongoose or stop mongoServer
});

afterEach(async () => {
  await Experiment.deleteMany({});
  await VoiceMetrics.deleteMany({});
});

describe('Task 12.1: SRM Detection (Traffic Integrity)', () => {
  it('should detect biased traffic split (80/20 instead of 50/50)', async () => {
    // Create experiment with 50/50 split
    const experiment = await Experiment.create({
      name: 'srm_test',
      description: 'Test SRM detection',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Simulate biased traffic: 80% A, 20% B
    const totalSamples = 1000;
    const variantACounts = 800;
    const variantBCounts = 200;

    // Create metrics with biased distribution
    const metricsA = Array.from({ length: variantACounts }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test query',
      correctedQuery: 'test query',
      correctedTo: 'test query',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'srm_test',
    }));

    const metricsB = Array.from({ length: variantBCounts }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test query',
      correctedQuery: 'test query',
      correctedTo: 'test query',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'srm_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    // Check SRM
    const srmResult = checkSRM({ A: variantACounts, B: variantBCounts }, 0.5, 0.05);

    expect(srmResult.hasSRM).toBe(true);
    expect(srmResult.details.A).toBeDefined();
    expect(srmResult.details.B).toBeDefined();
  });

  it('should NOT detect SRM with balanced traffic (50/50)', async () => {
    const variantACounts = 500;
    const variantBCounts = 500;

    const srmResult = checkSRM({ A: variantACounts, B: variantBCounts }, 0.5, 0.05);

    expect(srmResult.hasSRM).toBe(false);
  });

  it('should detect SRM in experiment results', async () => {
    const experiment = await Experiment.create({
      name: 'srm_results_test',
      description: 'Test SRM in results',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create biased metrics
    const metricsA = Array.from({ length: 700 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'srm_results_test',
    }));

    const metricsB = Array.from({ length: 300 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'srm_results_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const results = await getExperimentResults('srm_results_test');

    expect(results.srmCheck.hasSRM).toBe(true);
  });
});

describe('Task 12.2: Minimum Sample Size Enforcement', () => {
  it('should block winner declaration with insufficient samples (<1000)', async () => {
    const experiment = await Experiment.create({
      name: 'sample_size_test',
      description: 'Test minimum sample size',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create only 200 samples (below minimum)
    const metricsA = Array.from({ length: 100 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'sample_size_test',
    }));

    const metricsB = Array.from({ length: 100 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'sample_size_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const sampleSizeCheck = checkMinimumSampleSize(200, 1000);

    expect(sampleSizeCheck.sufficient).toBe(false);
    expect(sampleSizeCheck.message).toContain('more samples');
    expect(sampleSizeCheck.total).toBe(200);
    expect(sampleSizeCheck.required).toBe(1000);
  });

  it('should allow winner declaration with sufficient samples (>=1000)', async () => {
    const sampleSizeCheck = checkMinimumSampleSize(2000, 1000);

    expect(sampleSizeCheck.sufficient).toBe(true);
    expect(sampleSizeCheck.message).toContain('sufficient');
  });

  it('should return "Not enough data" in experiment results', async () => {
    const experiment = await Experiment.create({
      name: 'insufficient_samples',
      description: 'Test insufficient samples',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create only 50 samples
    const metrics = Array.from({ length: 50 }, (_, i) => ({
      userId: `user_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50,
      variant: i % 2 === 0 ? 'A' : 'B',
      experimentName: 'insufficient_samples',
    }));

    await VoiceMetrics.insertMany(metrics);

    const results = await getExperimentResults('insufficient_samples');

    expect(results.sampleSizeCheck.sufficient).toBe(false);
  });
});

describe('Task 12.3: Guardrail Monitoring', () => {
  it('should detect latency spike (>1.2x baseline)', async () => {
    const baselineMetrics = {
      A: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.05 },
      B: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 70, falseCorrectionRate: 0.05 },
    };

    const guardrailCheck = checkGuardrails(baselineMetrics, 'A');

    expect(guardrailCheck.shouldStop).toBe(true);
    expect(guardrailCheck.violations.length).toBeGreaterThan(0);
    expect(guardrailCheck.violations.some(v => v.metric === 'latency')).toBe(true);
  });

  it('should detect accuracy degradation (>5% drop)', async () => {
    const metrics = {
      A: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.05 },
      B: { accuracy: 0.75, trueAccuracy: 0.75, avgLatency: 50, falseCorrectionRate: 0.05 },
    };

    const guardrailCheck = checkGuardrails(metrics, 'A');

    expect(guardrailCheck.violations.length).toBeGreaterThan(0);
    expect(guardrailCheck.violations.some(v => v.metric === 'accuracy')).toBe(true);
  });

  it('should detect false correction rate spike (>10% increase)', async () => {
    const metrics = {
      A: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.05 },
      B: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.20 },
    };

    const guardrailCheck = checkGuardrails(metrics, 'A');

    expect(guardrailCheck.shouldStop).toBe(true);
    expect(guardrailCheck.violations.some(v => v.metric === 'falseCorrectionRate')).toBe(true);
  });

  it('should pass with normal metrics', async () => {
    const metrics = {
      A: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.05 },
      B: { accuracy: 0.86, trueAccuracy: 0.86, avgLatency: 52, falseCorrectionRate: 0.06 },
    };

    const guardrailCheck = checkGuardrails(metrics, 'A');

    expect(guardrailCheck.shouldStop).toBe(false);
    expect(guardrailCheck.violations).toHaveLength(0);
  });

  it('should auto-stop experiment on guardrail violation', async () => {
    const experiment = await Experiment.create({
      name: 'guardrail_test',
      description: 'Test auto-stop on guardrail violation',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create metrics with latency spike in variant B
    const metricsA = Array.from({ length: 500 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 50, // Normal latency
      variant: 'A',
      experimentName: 'guardrail_test',
    }));

    const metricsB = Array.from({ length: 500 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: true,
      isCorrectProduct: true,
      success: true,
      wasCorrected: false,
      latency: 150, // 3x baseline - major spike
      variant: 'B',
      experimentName: 'guardrail_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const result = await autoStopIfGuardrailsViolated('guardrail_test');

    expect(result.stopped).toBe(true);

    const updatedExperiment = await Experiment.findOne({ name: 'guardrail_test' });
    expect(updatedExperiment?.isActive).toBe(false);
  });
});

describe('Task 12.4: Statistical Significance', () => {
  it('should detect significant difference (p < 0.05) with clear winner', async () => {
    // Variant A: 82% accuracy (820/1000)
    // Variant B: 88% accuracy (880/1000)
    const significanceCheck = checkStatisticalSignificance(
      { successes: 820, total: 1000 },
      { successes: 880, total: 1000 }
    );

    expect(significanceCheck.significant).toBe(true);
    expect(significanceCheck.pValue).toBeLessThan(0.05);
  });

  it('should NOT detect significance with no difference', async () => {
    // Both variants: 85% accuracy
    const significanceCheck = checkStatisticalSignificance(
      { successes: 850, total: 1000 },
      { successes: 850, total: 1000 }
    );

    expect(significanceCheck.significant).toBe(false);
    expect(significanceCheck.pValue).toBeGreaterThan(0.05);
  });

  it('should NOT detect significance with small sample size', async () => {
    // Even with difference, small sample = not significant
    const significanceCheck = checkStatisticalSignificance(
      { successes: 8, total: 10 },
      { successes: 10, total: 10 }
    );

    expect(significanceCheck.significant).toBe(false);
  });
});

describe('Task 12.5: Auto-Winner Detection and Deployment', () => {
  it('should detect winner with clear improvement (2%+, 1000+ samples, p<0.05)', async () => {
    const experiment = await Experiment.create({
      name: 'winner_test',
      description: 'Test winner detection',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Variant A: 80% accuracy
    const metricsA = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 800, // 80% clicked
      isCorrectProduct: i < 800,
      success: i < 800,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'winner_test',
    }));

    // Variant B: 88% accuracy (8% improvement)
    const metricsB = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 880, // 88% clicked
      isCorrectProduct: i < 880,
      success: i < 880,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'winner_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const results = await getExperimentResults('winner_test');
    const winnerCheck = results.winnerDetection;

    // Log for debugging
    console.log('Winner detection result:', winnerCheck);
    console.log('Variants:', results.variants);

    expect(winnerCheck.winner).not.toBeNull();
    expect(winnerCheck.winner).toBe('B');
    expect(winnerCheck.improvement).toBeGreaterThan(0.02); // >2% improvement
    expect(winnerCheck.confidence).toBeGreaterThan(0.95); // >95% confidence
  });

  it('should NOT detect winner when criteria not met', async () => {
    const experiment = await Experiment.create({
      name: 'no_winner_test',
      description: 'Test no winner',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Both variants: 85% accuracy (no significant difference)
    const metricsA = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 850,
      isCorrectProduct: i < 850,
      success: i < 850,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'no_winner_test',
    }));

    const metricsB = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 850,
      isCorrectProduct: i < 850,
      success: i < 850,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'no_winner_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const results = await getExperimentResults('no_winner_test');
    const winnerCheck = results.winnerDetection;

    expect(winnerCheck.winner).toBeNull();
  });

  it('should auto-deploy winner when detected', async () => {
    const experiment = await Experiment.create({
      name: 'auto_deploy_test',
      description: 'Test auto-deploy',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create clear winner (B with 10% improvement)
    const metricsA = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_a_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 750, // 75%
      isCorrectProduct: i < 750,
      success: i < 750,
      wasCorrected: false,
      latency: 50,
      variant: 'A',
      experimentName: 'auto_deploy_test',
    }));

    const metricsB = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user_b_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: i < 850, // 85% (10% improvement)
      isCorrectProduct: i < 850,
      success: i < 850,
      wasCorrected: false,
      latency: 50,
      variant: 'B',
      experimentName: 'auto_deploy_test',
    }));

    await VoiceMetrics.insertMany([...metricsA, ...metricsB]);

    const result = await autoDeployWinnerIfDetected('auto_deploy_test');

    expect(result.deployed).toBe(true);
    expect(result.winner).toBe('B');

    const updatedExperiment = await Experiment.findOne({ name: 'auto_deploy_test' });
    expect(updatedExperiment?.isActive).toBe(false);
  });
});

describe('Task 12.5: Edge Cases', () => {
  it('should handle zero clicks gracefully (accuracy undefined)', async () => {
    const experiment = await Experiment.create({
      name: 'zero_clicks_test',
      description: 'Test zero clicks',
      variants: ['A', 'B'],
      trafficSplit: 0.5,
      rolloutPercentage: 100,
      config: new Map([
        ['A', { threshold: 0.6 }],
        ['B', { threshold: 0.7 }],
      ]),
      isActive: true,
    });

    // Create metrics with NO clicks
    const metrics = Array.from({ length: 100 }, (_, i) => ({
      userId: `user_${i}`,
      query: 'test',
      correctedQuery: 'test',
      correctedTo: 'test',
      matched: true,
      confidence: 0.8,
      source: 'algorithmic' as const,
      clickedProduct: false, // No clicks
      isCorrectProduct: false,
      success: false,
      wasCorrected: false,
      latency: 50,
      variant: i % 2 === 0 ? 'A' : 'B',
      experimentName: 'zero_clicks_test',
    }));

    await VoiceMetrics.insertMany(metrics);

    const results = await getExperimentResults('zero_clicks_test');

    // Should not crash, should handle gracefully
    expect(results).toBeDefined();
    expect(results.variants.A).toBeDefined();
    expect(results.variants.B).toBeDefined();
  });

  it('should handle equal variants (no winner)', async () => {
    const significanceCheck = checkStatisticalSignificance(
      { successes: 850, total: 1000 },
      { successes: 850, total: 1000 }
    );

    expect(significanceCheck.significant).toBe(false);
  });

  it('should prevent zero division in guardrail checks', async () => {
    const metrics = {
      A: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 1, falseCorrectionRate: 0.01 },
      B: { accuracy: 0.85, trueAccuracy: 0.85, avgLatency: 50, falseCorrectionRate: 0.05 },
    };

    const guardrailCheck = checkGuardrails(metrics, 'A');

    // Should not crash
    expect(guardrailCheck).toBeDefined();
  });
});
