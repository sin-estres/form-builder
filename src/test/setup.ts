/**
 * Test setup file for Vitest
 * This file runs before all tests
 */

// Setup DOM environment
import { beforeEach, afterEach } from 'vitest';

// Clean up DOM after each test
afterEach(() => {
    // Clean up any remaining DOM elements
    document.body.innerHTML = '';
});

// Mock console methods to reduce noise in tests (optional)
// global.console = {
//     ...console,
//     log: vi.fn(),
//     debug: vi.fn(),
//     info: vi.fn(),
//     warn: vi.fn(),
//     error: vi.fn(),
// };
