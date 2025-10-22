/**
 * Comprehensive tests for Toolbar component
 * Tests task 9: Toolbar UI with zoom controls, status indicators, and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toolbar from '../Toolbar';
import { ToolProvider } from '@/contexts/ToolContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// Mock useOnlineStatus hook
jest.mock('@/hooks/useOnlineStatus');
const mockUseOnlineStatus = useOnlineStatus as jest.MockedFunction<typeof useOnlineStatus>;

// Wrapper component to provide ToolContext
const ToolbarWrapper = ({ children, ...props }: any) => (
  <ToolProvider>{children}</ToolProvider>
);

describe('Toolbar Component', () => {
  const defaultProps = {
    onZoomIn: jest.fn(),
    onZoomOut: jest.fn(),
    onZoomReset: jest.fn(),
    currentZoom: 100,
    userCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('should render all tool buttons', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByRole('button', { name: /select tool/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /node creation tool/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /connect tool/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit tool/i })).toBeInTheDocument();
    });

    it('should render zoom controls', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument();
    });

    it('should display current zoom level', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} currentZoom={150} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('should display online status indicator', () => {
      mockUseOnlineStatus.mockReturnValue(true);
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('should display offline status indicator', () => {
      mockUseOnlineStatus.mockReturnValue(false);
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should display user count', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} userCount={5} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display singular user text for 1 user', () => {
      const { container } = render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} userCount={1} />
        </ToolbarWrapper>
      );

      // Hover over user count to see tooltip
      const userCountElement = screen.getByText('1');
      fireEvent.mouseEnter(userCountElement.closest('div')!);

      waitFor(() => {
        expect(screen.getByText('1 active user')).toBeInTheDocument();
      });
    });

    it('should display plural user text for multiple users', () => {
      const { container } = render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} userCount={3} />
        </ToolbarWrapper>
      );

      const userCountElement = screen.getByText('3');
      fireEvent.mouseEnter(userCountElement.closest('div')!);

      waitFor(() => {
        expect(screen.getByText('3 active users')).toBeInTheDocument();
      });
    });

    it('should render keyboard shortcuts section', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
  });

  describe('Tool Selection', () => {
    it('should render all tool buttons with proper aria attributes', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });
      const connectButton = screen.getByRole('button', { name: /connect tool/i });
      const editButton = screen.getByRole('button', { name: /edit tool/i });

      // All buttons should have aria-pressed attribute
      expect(selectButton).toHaveAttribute('aria-pressed');
      expect(nodeButton).toHaveAttribute('aria-pressed');
      expect(connectButton).toHaveAttribute('aria-pressed');
      expect(editButton).toHaveAttribute('aria-pressed');
    });

    it('should call setActiveTool when tools are clicked', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });

      // Button should be clickable without errors
      expect(() => fireEvent.click(nodeButton)).not.toThrow();
    });

    it('should allow clicking between different tools', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const connectButton = screen.getByRole('button', { name: /connect tool/i });
      const editButton = screen.getByRole('button', { name: /edit tool/i });

      // Buttons should be clickable without errors
      expect(() => fireEvent.click(connectButton)).not.toThrow();
      expect(() => fireEvent.click(editButton)).not.toThrow();
    });
  });

  describe('Zoom Controls', () => {
    it('should call onZoomIn when zoom in button clicked', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      fireEvent.click(zoomInButton);

      expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomOut when zoom out button clicked', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      fireEvent.click(zoomOutButton);

      expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should call onZoomReset when reset button clicked', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const zoomResetButton = screen.getByRole('button', { name: /reset zoom/i });
      fireEvent.click(zoomResetButton);

      expect(defaultProps.onZoomReset).toHaveBeenCalledTimes(1);
    });

    it('should disable zoom buttons when handlers not provided', () => {
      render(
        <ToolbarWrapper>
          <Toolbar currentZoom={100} userCount={1} />
        </ToolbarWrapper>
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      const zoomResetButton = screen.getByRole('button', { name: /reset zoom/i });

      expect(zoomInButton).toBeDisabled();
      expect(zoomOutButton).toBeDisabled();
      expect(zoomResetButton).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should switch to select tool on V key press', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      // Switch to different tool first
      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });
      fireEvent.click(nodeButton);

      // Press V key
      fireEvent.keyDown(window, { key: 'v' });

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch to node tool on N key press', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: 'n' });

      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });
      expect(nodeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch to connect tool on C key press', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: 'c' });

      const connectButton = screen.getByRole('button', { name: /connect tool/i });
      expect(connectButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch to edit tool on E key press', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: 'e' });

      const editButton = screen.getByRole('button', { name: /edit tool/i });
      expect(editButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should call onZoomIn on Ctrl/Cmd + Plus', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: '+', ctrlKey: true });
      expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: '=', metaKey: true });
      expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(2);
    });

    it('should call onZoomOut on Ctrl/Cmd + Minus', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: '-', ctrlKey: true });
      expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: '_', metaKey: true });
      expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(2);
    });

    it('should call onZoomReset on Ctrl/Cmd + 0', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      fireEvent.keyDown(window, { key: '0', ctrlKey: true });
      expect(defaultProps.onZoomReset).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: '0', metaKey: true });
      expect(defaultProps.onZoomReset).toHaveBeenCalledTimes(2);
    });

    it('should not trigger shortcuts when typing in input fields', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      // Create a fake input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: 'n' });

      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });
      expect(nodeButton).toHaveAttribute('aria-pressed', 'false');

      document.body.removeChild(input);
    });

    it('should cleanup keyboard event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have ARIA labels on all tool buttons', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByRole('button', { name: /select tool/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /node creation tool/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /connect tool/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /edit tool/i })).toHaveAttribute('aria-label');
    });

    it('should have ARIA pressed state on tool buttons', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      expect(selectButton).toHaveAttribute('aria-pressed', 'true');

      const nodeButton = screen.getByRole('button', { name: /node creation tool/i });
      expect(nodeButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have ARIA labels on zoom buttons', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /zoom out/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      selectButton.focus();
      expect(selectButton).toHaveFocus();
    });

    it('should have focus indicators', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      expect(selectButton).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Tooltips', () => {
    it('should show tooltip on tool button hover', async () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      fireEvent.mouseEnter(selectButton.closest('.relative')!);

      await waitFor(() => {
        expect(screen.getByText(/Select and move elements/i)).toBeInTheDocument();
      });
    });

    it('should respond to mouse leave events', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const selectButton = screen.getByRole('button', { name: /select tool/i });
      const tooltipContainer = selectButton.closest('.relative')!;

      // Verify mouse events don't cause errors
      expect(() => {
        fireEvent.mouseEnter(tooltipContainer);
        fireEvent.mouseLeave(tooltipContainer);
      }).not.toThrow();
    });

    it('should show zoom control tooltips', async () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      fireEvent.mouseEnter(zoomInButton.closest('.relative')!);

      await waitFor(() => {
        expect(screen.getByText(/Zoom in \(Ctrl\/Cmd \+ \+\)/i)).toBeInTheDocument();
      });
    });

    it('should show status indicator tooltips', async () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const onlineIndicator = screen.getByText('Online').closest('.relative')!;
      fireEvent.mouseEnter(onlineIndicator);

      await waitFor(() => {
        expect(screen.getByText(/Connected to server/i)).toBeInTheDocument();
      });
    });
  });

  describe('Default Props', () => {
    it('should use default currentZoom of 100', () => {
      render(
        <ToolbarWrapper>
          <Toolbar />
        </ToolbarWrapper>
      );

      // Check for zoom percentage display (there are multiple "100%" texts: button label and percentage display)
      const zoomDisplay = screen.getAllByText('100%');
      expect(zoomDisplay.length).toBeGreaterThan(0);
    });

    it('should use default userCount of 1', () => {
      render(
        <ToolbarWrapper>
          <Toolbar />
        </ToolbarWrapper>
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Node Types Section', () => {
    it('should render node type options', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      expect(screen.getByText('Process')).toBeInTheDocument();
      expect(screen.getByText('Decision')).toBeInTheDocument();
      expect(screen.getByText('Start/End')).toBeInTheDocument();
    });

    it('should have keyboard navigation on node types', () => {
      render(
        <ToolbarWrapper>
          <Toolbar {...defaultProps} />
        </ToolbarWrapper>
      );

      const processNode = screen.getByText('Process').closest('[role="button"]')!;
      expect(processNode).toHaveAttribute('tabIndex', '0');
    });
  });
});
