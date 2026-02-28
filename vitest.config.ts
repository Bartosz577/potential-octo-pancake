import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/core/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: 'coverage',
      include: [
        'src/core/**/*.ts',
        'src/renderer/src/bridge/**/*.ts',
        'src/renderer/src/stores/**/*.ts',
        'src/renderer/src/utils/**/*.ts'
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts', '**/types.ts', '**/usePipelineBridge.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  }
})

