# @fypai/types

Shared TypeScript types for the fypai collaborative AI productivity application.

## Overview

This package contains type definitions shared between frontend and backend:

- **Entities**: Database entity types matching Prisma schema exactly
- **DTOs**: Data Transfer Objects for API requests/responses (frontend-friendly)
- **Enums**: Shared enumerations and constants
- **Utils**: Type transformation utilities

## Structure

```
src/
├── entities.ts   - Core database entity types (Prisma-aligned)
├── dtos.ts       - API DTOs with parsed JSON and ISO strings
├── enums.ts      - Shared enums (UserRole, TeamRole, etc.)
├── utils.ts      - Type transformation utilities
└── index.ts      - Main exports
```

## Usage

### Backend (Node.js/Express)
```typescript
import { User, Message, UserRole } from '@fypai/types'
```

### Frontend (React)
```typescript
import { UserDTO, MessageDTO, TeamWithMembers } from '@fypai/types'
```

## Design Decisions

### 1. Entity Types (Prisma-aligned)
- Use exact Prisma schema types
- Dates as `Date` objects
- JSON fields as `string | null`
- Match all field names and nullability

### 2. DTO Types (API-friendly)
- Dates as ISO strings for JSON serialization
- Parsed JSON fields (metadata, tags as objects/arrays)
- Nested relations (TeamWithMembers includes user data)
- Optional fields use `?` notation

### 3. Enums
- Use TypeScript enums for type safety
- Match backend string literal values
- Export both enum and union types for flexibility

### 4. Transformation
- Utilities to convert Entity ↔ DTO
- Handle Date ↔ ISO string conversion
- Handle JSON string ↔ parsed object conversion

## Build

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm run clean    # Remove dist folder
```
