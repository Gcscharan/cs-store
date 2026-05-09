import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GlobalConnectivityBanner } from '../GlobalConnectivityBanner';
import { ConnectivityState } from '../../../../hooks/delivery/useConnectivityState';

// Mock useConnectivityState so we can control state in tests
jest.mock('../../../../hooks/delivery/useConnectivityState', () => ({
  useConnectivityState: jest.fn(),
}));

import { useConnectivityState } from '../../../../hooks/delivery/useConnectivityState';

const mockUseConnectivityState = useConnectivityState as jest.MockedFunction<typeof useConnectivityState>;

describe('GlobalConnectivityBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('State Display', () => {
    it('should hide when online with empty queue', () => {
      const state: ConnectivityState = { type: 'online' };
      mockUseConnectivityState.mockReturnValue(state);

      const { queryByText } = render(<GlobalConnectivityBanner />);

      expect(queryByText(/./)).toBeNull();
    });

    it('should display "Offline" when offline', () => {
      const state: ConnectivityState = { type: 'offline' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByText, getByLabelText } = render(<GlobalConnectivityBanner />);

      expect(getByText('Offline')).toBeTruthy();
      expect(getByLabelText('Offline')).toBeTruthy();
    });

    it('should display "Syncing X actions" when syncing', () => {
      const state: ConnectivityState = { type: 'syncing', count: 5 };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByText } = render(<GlobalConnectivityBanner />);

      expect(getByText('Syncing 5 actions')).toBeTruthy();
    });

    it('should display "Syncing 1 action" (singular) when syncing one action', () => {
      const state: ConnectivityState = { type: 'syncing', count: 1 };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByText } = render(<GlobalConnectivityBanner />);

      expect(getByText('Syncing 1 action')).toBeTruthy();
    });

    it('should display "Reconnected" when reconnected', () => {
      const state: ConnectivityState = { type: 'reconnected', timestamp: Date.now() };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByText } = render(<GlobalConnectivityBanner />);

      expect(getByText('Reconnected')).toBeTruthy();
    });

    it('should display "Queue replaying" when replaying', () => {
      const state: ConnectivityState = { type: 'replaying' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByText } = render(<GlobalConnectivityBanner />);

      expect(getByText('Queue replaying')).toBeTruthy();
    });
  });

  describe('Force Sync Button', () => {
    it('should show Force Sync button when syncing and onForceSync is provided', () => {
      const state: ConnectivityState = { type: 'syncing', count: 3 };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { getByText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      expect(getByText('Force Sync')).toBeTruthy();
    });

    it('should show Force Sync button when replaying and onForceSync is provided', () => {
      const state: ConnectivityState = { type: 'replaying' };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { getByText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      expect(getByText('Force Sync')).toBeTruthy();
    });

    it('should not show Force Sync button when onForceSync is not provided', () => {
      const state: ConnectivityState = { type: 'syncing', count: 15 };
      mockUseConnectivityState.mockReturnValue(state);

      const { queryByText } = render(<GlobalConnectivityBanner />);

      expect(queryByText('Force Sync')).toBeNull();
    });

    it('should call onForceSync when Force Sync button is pressed', () => {
      const state: ConnectivityState = { type: 'syncing', count: 5 };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { getByText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      fireEvent.press(getByText('Force Sync'));
      expect(onForceSync).toHaveBeenCalledTimes(1);
    });

    it('should not show Force Sync button for offline state', () => {
      const state: ConnectivityState = { type: 'offline' };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { queryByText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      expect(queryByText('Force Sync')).toBeNull();
    });

    it('should not show Force Sync button for reconnected state', () => {
      const state: ConnectivityState = { type: 'reconnected', timestamp: Date.now() };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { queryByText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      expect(queryByText('Force Sync')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility role "alert"', () => {
      const state: ConnectivityState = { type: 'offline' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Offline');
      expect(banner.props.accessibilityRole).toBe('alert');
    });

    it('should have accessibility label matching the message', () => {
      const state: ConnectivityState = { type: 'syncing', count: 3 };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      expect(getByLabelText('Syncing 3 actions')).toBeTruthy();
    });

    it('should have accessibility live region set to polite', () => {
      const state: ConnectivityState = { type: 'offline' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Offline');
      expect(banner.props.accessibilityLiveRegion).toBe('polite');
    });

    it('should have accessible Force Sync button with label and hint', () => {
      const state: ConnectivityState = { type: 'syncing', count: 5 };
      mockUseConnectivityState.mockReturnValue(state);
      const onForceSync = jest.fn();

      const { getByLabelText } = render(<GlobalConnectivityBanner onForceSync={onForceSync} />);

      const button = getByLabelText('Force sync queued actions');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityHint).toBe('Manually trigger queue replay to sync pending actions');
    });
  });

  describe('Color Scheme', () => {
    it('should use red background for offline state', () => {
      const state: ConnectivityState = { type: 'offline' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Offline');
      expect(banner.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#E53E3E' }),
        ])
      );
    });

    it('should use yellow background for syncing state', () => {
      const state: ConnectivityState = { type: 'syncing', count: 2 };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Syncing 2 actions');
      expect(banner.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#D69E2E' }),
        ])
      );
    });

    it('should use green background for reconnected state', () => {
      const state: ConnectivityState = { type: 'reconnected', timestamp: Date.now() };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Reconnected');
      expect(banner.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#38A169' }),
        ])
      );
    });

    it('should use yellow background for replaying state', () => {
      const state: ConnectivityState = { type: 'replaying' };
      mockUseConnectivityState.mockReturnValue(state);

      const { getByLabelText } = render(<GlobalConnectivityBanner />);

      const banner = getByLabelText('Queue replaying');
      expect(banner.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#D69E2E' }),
        ])
      );
    });
  });
});
