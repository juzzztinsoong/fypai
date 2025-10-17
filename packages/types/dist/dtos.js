/**
 * Data Transfer Object (DTO) Types
 *
 * These types are optimized for API communication between frontend and backend.
 * They differ from entity types in several ways:
 *
 * Key Differences from Entities:
 * - Dates are ISO strings (JSON-serializable)
 * - JSON fields are parsed into typed objects/arrays
 * - Optional fields use `?` notation (more frontend-friendly)
 * - Nested relations are included (e.g., TeamWithMembers)
 * - Some fields may be omitted (e.g., updatedAt if not needed by frontend)
 *
 * Use these types for:
 * - API request/response bodies
 * - Frontend state management (Zustand stores)
 * - React component props
 */
export {};
