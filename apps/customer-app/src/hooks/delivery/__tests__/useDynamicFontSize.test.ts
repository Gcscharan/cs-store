/**
 * Unit Tests for useDynamicFontSize hook
 *
 * **Validates: Requirement 15.2**
 *
 * Tests dynamic font sizing with system font scale, ensuring proper capping at 1.3x.
 */

import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useDynamicFontSize } from '../useDynamicFontSize';

// Mock useWindowDimensions
jest.mock('react-native', () => ({
  useWindowDimensions: jest.fn(),
}));

const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

describe('useDynamicFontSize', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns base size when fontScale is 1.0', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.0,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result } = renderHook(() => useDynamicFontSize(16));
    expect(result.current).toBe(16);
  });

  it('scales font size when fontScale is 1.2', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.2,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result } = renderHook(() => useDynamicFontSize(16));
    expect(result.current).toBe(19.2);
  });

  it('caps font size at 1.3x when fontScale is 1.5', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.5,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result } = renderHook(() => useDynamicFontSize(16));
    expect(result.current).toBe(20.8); // 16 * 1.3 = 20.8
  });

  it('caps font size at 1.3x when fontScale is 2.0', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 2.0,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result } = renderHook(() => useDynamicFontSize(16));
    expect(result.current).toBe(20.8); // 16 * 1.3 = 20.8
  });

  it('works with different base sizes', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.3,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result: result24 } = renderHook(() => useDynamicFontSize(24));
    expect(result24.current).toBeCloseTo(31.2, 1); // 24 * 1.3 = 31.2

    const { result: result12 } = renderHook(() => useDynamicFontSize(12));
    expect(result12.current).toBeCloseTo(15.6, 1); // 12 * 1.3 = 15.6
  });

  it('handles fontScale less than 1.0', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 0.8,
      width: 375,
      height: 812,
      scale: 2,
    });

    const { result } = renderHook(() => useDynamicFontSize(16));
    expect(result.current).toBe(12.8); // 16 * 0.8 = 12.8
  });
});
