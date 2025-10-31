# Collaborative Canvas Planner
A multi-user, real-time tool for visual planning. I had tried Figma to plan with others, and wanted to learn more about sync engines, websockets, and multiplayer. Uses a node-based interface, built with react-flow and convex.

## Tech Stack

- [Next.js 15](https://nextjs.org) - React framework with App Router
- [TypeScript](https://www.typescriptlang.org) - Type-safe development
- [ReactFlow](https://reactflow.dev) - Node-based workflow visualization
- [Convex](https://convex.dev) - Sync + backend
- [Socket.IO](https://socket.io) - WebSocket communication
- [Tailwind CSS](https://tailwindcss.com) - Utility-first styling

## Quick Start

**Prerequisites:** Node.js 18+ required

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Troubleshooting

**Port already in use:**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Cache issues:**
```bash
rm -rf .next
npm run build
npm run dev
```

## Project Structure

```
figmaApp/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library configurations
│   └── utils/            # Utility functions
├── convex/               # Convex backend (queries/mutations)
├── server.js             # Custom Next.js + Socket.IO server
└── .env                  # Environment configuration
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimized production bundle |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint for code quality |
| `npm test` | Run Jest test suite |

### Convex Integration

Backend functions are defined in `convex/` directory:

```typescript
import { query, mutation } from "./_generated/server";

export const getWorkflows = query({
  handler: async (ctx) => {
    return await ctx.db.query("workflows").collect();
  },
});
```

Convex automatically generates type-safe client functions from backend definitions.

### Keyboard Shortcuts

| Key | Tool | Description |
|-----|------|-------------|
| `V` | Select | Select and move elements |
| `N` | Add Node | Create new workflow nodes |

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

**Live Demo:** [https://jordypg.com/canvasplanner](https://jordypg.com/canvasplanner)

## License

MIT
