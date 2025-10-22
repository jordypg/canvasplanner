# Workflow Canvas

A collaborative workflow design tool built with Next.js, React, TypeScript, ReactFlow, and Convex.

## Features

- Real-time collaborative canvas
- Node-based workflow design
- Multiplayer cursor tracking
- Persistent data storage with Convex

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **ReactFlow** - Node-based workflow visualization
- **Convex** - Real-time backend and database
- **Tailwind CSS** - Utility-first styling

## Project Structure

```
figmaApp/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Global styles
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library configurations
│   └── utils/            # Utility functions
├── convex/               # Convex backend functions
│   └── tsconfig.json     # Convex TypeScript config
├── .env.local            # Local environment variables
└── package.json          # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Convex:
   ```bash
   npx convex dev
   ```
   This will create a Convex project and update your `.env.local` file with the deployment URL.

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Development

### Adding Components

Create new components in `src/components/`:
```typescript
export default function MyComponent() {
  return <div>My Component</div>;
}
```

### Creating Custom Hooks

Add custom hooks in `src/hooks/`:
```typescript
export function useMyHook() {
  // Hook logic
}
```

### Working with Convex

Define backend functions in the `convex/` directory:
```typescript
// convex/myFunction.ts
import { query } from "./_generated/server";

export default query({
  handler: async (ctx) => {
    // Query logic
  },
});
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT
