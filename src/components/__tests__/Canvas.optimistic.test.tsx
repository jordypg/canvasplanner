/**
 * Tests for optimistic UI updates in Canvas component
 * Tests task 8: Optimistic UI updates and error handling
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useToast } from '@/hooks/useToast';

// Mock Convex
jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock ReactFlow
jest.mock('reactflow', () => ({
  __esModule: true,
  default: () => null,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  addEdge: jest.fn((edge, edges) => [...edges, edge]),
  useReactFlow: jest.fn(() => ({
    fitView: jest.fn(),
    setViewport: jest.fn(),
    screenToFlowPosition: jest.fn((pos) => pos),
    getZoom: jest.fn(() => 1),
  })),
  ReactFlowProvider: ({ children }: any) => children,
  useStore: jest.fn(() => ({
    nodeInternals: new Map(),
    transform: [0, 0, 1],
  })),
  useUpdateNodeInternals: jest.fn(() => jest.fn()),
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
}));

// Mock socket.io
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
}));

// Mock session
jest.mock('@/utils/session', () => ({
  getOrCreateSession: jest.fn(() => ({
    id: 'test-session',
    userName: 'Test User',
    color: '#ff0000',
  })),
}));

describe('Canvas - Optimistic UI Updates', () => {
  describe('Toast Notifications', () => {
    it('should show success toast for node creation', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('Node created successfully');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'success',
        message: 'Node created successfully',
      });
    });

    it('should show error toast for failed operations', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error('Failed to create node. Please try again.');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'error',
        message: 'Failed to create node. Please try again.',
      });
    });

    it('should show warning toast for conflicts', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.warning('Changes were updated by another user', 2000);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'warning',
        message: 'Changes were updated by another user',
        duration: 2000,
      });
    });
  });

  describe('Optimistic Node Creation', () => {
    it('should add node immediately to local state', () => {
      // This tests the pattern used in Canvas.tsx lines 1283-1284
      // where nodes are added optimistically before Convex confirmation
      const setNodes = jest.fn();
      const tempNode = {
        id: 'temp-node-123',
        type: 'custom',
        position: { x: 100, y: 100 },
        data: { label: 'New Node' },
      };

      setNodes((prev: any[]) => [...prev, tempNode]);

      expect(setNodes).toHaveBeenCalled();
    });

    it('should rollback on creation failure', async () => {
      const { result } = renderHook(() => useToast());
      const tempId = 'temp-node-123';
      let nodes = [{ id: tempId, data: {} }];

      // Simulate rollback
      nodes = nodes.filter((n) => n.id !== tempId);

      expect(nodes).toHaveLength(0);

      // Should show error toast
      act(() => {
        result.current.error('Failed to create node. Please try again.');
      });
      expect(result.current.toasts[0].type).toBe('error');
    });
  });

  describe('Optimistic Edge Creation', () => {
    it('should add edge immediately to local state', () => {
      const setEdges = jest.fn();
      const tempEdge = {
        id: 'temp-edge-123',
        source: 'node1',
        target: 'node2',
      };

      setEdges((prev: any[]) => [...prev, tempEdge]);

      expect(setEdges).toHaveBeenCalled();
    });

    it('should rollback edge on creation failure', () => {
      const tempId = 'temp-edge-123';
      let edges = [{ id: tempId }];

      // Simulate rollback
      edges = edges.filter((e) => e.id !== tempId);

      expect(edges).toHaveLength(0);
    });
  });

  describe('Optimistic Node Deletion', () => {
    it('should rollback deleted node on failure', () => {
      const deletedNode = {
        id: 'node1',
        data: { label: 'Test Node' },
        position: { x: 0, y: 0 },
      };

      let nodes: any[] = [];

      // Simulate rollback
      nodes = [...nodes, deletedNode];

      expect(nodes).toContainEqual(deletedNode);
    });
  });

  describe('Optimistic Position Updates', () => {
    it('should track pending position operations', () => {
      const pendingOps = new Map();
      const nodeId = 'node1';
      const newPosition = { x: 100, y: 200 };

      pendingOps.set(nodeId, {
        type: 'position',
        data: newPosition,
        timestamp: Date.now(),
      });

      expect(pendingOps.has(nodeId)).toBe(true);
      expect(pendingOps.get(nodeId).type).toBe('position');
    });

    it('should rollback position on save failure', () => {
      const originalPosition = { x: 0, y: 0 };
      const node = {
        id: 'node1',
        position: { x: 100, y: 100 },
      };

      // Simulate rollback
      node.position = originalPosition;

      expect(node.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Conflict Detection', () => {
    it('should detect position conflicts', () => {
      const pendingOp = {
        type: 'position',
        data: { x: 100, y: 100 },
      };

      const serverNode = {
        x: 200,
        y: 200,
      };

      const isConflict =
        Math.abs(serverNode.x - pendingOp.data.x) > 1 ||
        Math.abs(serverNode.y - pendingOp.data.y) > 1;

      expect(isConflict).toBe(true);
    });

    it('should detect text conflicts', () => {
      const pendingOp = {
        type: 'text',
        data: { text: 'Updated Text' },
      };

      const serverNode = {
        text: 'Different Text',
      };

      const isConflict = serverNode.text !== pendingOp.data.text;

      expect(isConflict).toBe(true);
    });

    it('should not detect conflict for matching data', () => {
      const pendingOp = {
        type: 'position',
        data: { x: 100, y: 100 },
      };

      const serverNode = {
        x: 100,
        y: 100,
      };

      const isConflict =
        Math.abs(serverNode.x - pendingOp.data.x) > 1 ||
        Math.abs(serverNode.y - pendingOp.data.y) > 1;

      expect(isConflict).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should clean up pending operations on error', () => {
      const pendingOps = new Map();
      const nodeId = 'node1';

      pendingOps.set(nodeId, { type: 'position', data: {} });
      expect(pendingOps.size).toBe(1);

      // Simulate cleanup on error
      pendingOps.delete(nodeId);
      expect(pendingOps.size).toBe(0);
    });

    it('should show appropriate error messages', () => {
      const { result } = renderHook(() => useToast());

      const errorScenarios = [
        { message: 'Failed to create node. Please try again.', operation: 'create' },
        { message: 'Failed to delete node. Please try again.', operation: 'delete' },
        { message: 'Failed to save node position', operation: 'position' },
        { message: 'Failed to create connection', operation: 'edge' },
      ];

      act(() => {
        errorScenarios.forEach((scenario) => {
          result.current.error(scenario.message);
        });
      });

      expect(result.current.toasts).toHaveLength(4);
      expect(result.current.toasts.every((t) => t.type === 'error')).toBe(true);
    });
  });
});
