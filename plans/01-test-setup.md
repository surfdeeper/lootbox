# Plan: Test Framework Setup

## Goal
Set up Vitest and React Testing Library for the lootbox project.

## Steps

1. Install dependencies:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. Add test script to `package.json`:
   ```json
   "scripts": {
     "test": "vitest",
     "test:run": "vitest run",
     "test:coverage": "vitest run --coverage"
   }
   ```

3. Create `vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
       globals: true,
     },
   })
   ```

4. Create `src/test/setup.ts`:
   ```ts
   import '@testing-library/jest-dom'
   ```

5. Update `tsconfig.json` to include Vitest types

## Verification
- Run `npm test` and confirm Vitest starts without errors
