# Shared Types Package - Design Decisions

## Overview
This document explains the key design decisions made when creating the `@fypai/types` shared types package to align frontend and backend types.

---

## 🎯 **Key Design Decisions**

### **1. AIInsight Type Name: `'action'` vs `'action-item'`**

**Decision:** Use `'action'` (single word)

**Rationale:**
- Consistency with other single-word types: `'summary'`, `'suggestion'`, `'analysis'`, `'code'`, `'document'`
- Simpler enum value
- Backend can still display as "Action Item" in UI through localization
- Easier to type and less error-prone

**Impact:**
- ✅ Frontend store will change from `'action-item'` to `'action'`
- ✅ Backend Prisma schema already uses string, no migration needed
- ✅ Update enum: `InsightType.ACTION = 'action'`

---

### **2. AIInsight Metadata Structure**

**Decision:** Separate `priority` and `tags` as top-level fields (not nested in metadata)

**Rationale:**
- Easier to query and filter in database
- More performant for indexing
- Backend Prisma schema already has them as separate fields
- Frontend can filter by priority without parsing JSON

**Structure:**
```typescript
// Entity (Backend/Database)
{
  priority: 'low' | 'medium' | 'high' | null
  tags: string | null  // JSON array: '["tag1", "tag2"]'
  // metadata doesn't exist in DB
}

// DTO (Frontend/API)
{
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]  // Parsed array
  metadata?: {     // Additional context
    language?: string
    filename?: string
  }
}
```

**Impact:**
- ⚠️ Frontend store has priority/tags in metadata - needs restructuring
- ✅ Backend schema matches decision
- ✅ DTOs provide parsed arrays for frontend

---

### **3. Date Handling: `Date` vs ISO `string`**

**Decision:** Use `Date` objects in entities, ISO strings in DTOs

**Rationale:**
- **Entities (backend)**: Prisma returns `Date` objects, keep type safety
- **DTOs (API)**: JSON can't serialize Date objects, use ISO strings
- Clear separation of concerns
- Transformation utilities handle conversion

**Usage:**
```typescript
// Backend (Entity)
const user: User = await prisma.user.findUnique(...)
// user.createdAt is Date object

// API Response (DTO)
const userDTO: UserDTO = userToDTO(user)
// userDTO.createdAt is "2025-10-14T18:54:13.756Z"
```

**Impact:**
- ✅ Backend controllers use entities with Date objects
- ✅ API responses use DTOs with ISO strings
- ✅ Frontend receives and works with ISO strings
- ✅ Utilities handle all conversions

---

### **4. JSON Fields: `string | null` vs Parsed Objects**

**Decision:** Store as JSON strings in entities, parse in DTOs

**Rationale:**
- Database stores as JSON string (Prisma limitation with SQLite/Postgres)
- Type safety: parsed objects in DTOs prevent runtime errors
- Flexibility: metadata structure can evolve without migrations

**Examples:**
```typescript
// Entity (Database)
message.metadata: string | null  // '{"suggestions":["a","b"]}'
insight.tags: string | null       // '["tag1","tag2"]'

// DTO (API/Frontend)
messageDTO.metadata?: {
  suggestions?: string[]
  parentMessageId?: string
}
insightDTO.tags?: string[]
```

**Impact:**
- ✅ Backend stores JSON strings
- ✅ Controllers use transformation utilities
- ✅ Frontend receives typed objects
- ✅ Type safety at API boundary

---

### **5. Nullable Fields: `| null` vs `?` Optional**

**Decision:** Use `| null` in entities, `?` in DTOs

**Rationale:**
- **Entities**: Match Prisma schema exactly (uses `| null` for nullable)
- **DTOs**: More frontend-friendly (`?` is cleaner for optional fields)
- Clear distinction between "not set" (undefined) and "explicitly null"

**Examples:**
```typescript
// Entity
interface User {
  email: string | null  // Prisma nullable field
}

// DTO
interface UserDTO {
  email: string | null  // Keep null for explicit "no email"
  role?: string         // Optional field (may not be included)
}
```

**Impact:**
- ✅ Backend entities match Prisma exactly
- ✅ DTOs are more ergonomic for frontend
- ✅ Clear semantics for each layer

---

### **6. TeamMember Role: `role` vs `teamRole`**

**Decision:** Use two separate fields

**Rationale:**
- **`role`**: Application-level role (member/admin/agent)
- **`teamRole`**: Team-specific role (owner/admin/member)
- User can be app-level member but team owner
- Allows fine-grained permissions

**Structure:**
```typescript
interface TeamMemberDTO {
  userId: string
  name: string
  role: 'member' | 'admin' | 'agent'        // From User
  teamRole: 'owner' | 'admin' | 'member'    // From TeamMember
}
```

**Impact:**
- ⚠️ Frontend currently uses only `role` - needs to add `teamRole`
- ✅ Backend already has both fields
- ✅ Frontend needs to add 'owner' option
- ✅ More flexible permission system

---

### **7. Message `authorId`: `string | 'agent'` vs `string`**

**Decision:** Always use valid user ID (create AI agent as user)

**Rationale:**
- Referential integrity: foreign key to User table
- AI agent is a real user with `role: 'agent'`
- Simpler queries and joins
- Consistent data model

**Implementation:**
```typescript
// Create AI agent user
const agent = await prisma.user.create({
  name: 'AI Assistant',
  role: 'agent',
  avatar: '🤖'
})

// Use agent.id in messages
message.authorId = agent.id  // Always a valid user ID
```

**Impact:**
- ⚠️ Frontend allows `authorId: 'agent'` - needs fix
- ✅ Backend already uses proper user IDs
- ✅ Database has referential integrity
- ✅ Can query author info consistently

---

### **8. Enum Types: TypeScript Enums vs String Literals**

**Decision:** Export both enum and string literal union types

**Rationale:**
- **Enums**: Type safety, autocomplete in IDEs
- **String literals**: More flexible, better for API contracts
- Export both, let consumers choose

**Usage:**
```typescript
// Define enum
export enum UserRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  AGENT = 'agent',
}

// Also export string literal
export type UserRoleString = 'member' | 'admin' | 'agent'

// Backend can use enum
const role: UserRole = UserRole.ADMIN

// Frontend can use string
const role: UserRoleString = 'admin'
```

**Impact:**
- ✅ Both frontend and backend can choose preference
- ✅ API contracts use string literals
- ✅ Internal code can use enums for safety
- ✅ Maximum flexibility

---

### **9. Team `description` Field**

**Decision:** Remove from shared types (frontend-only feature, not implemented)

**Rationale:**
- Not in backend Prisma schema
- Not implemented in backend API
- Adding would require migration
- Can be added later if needed

**Impact:**
- ⚠️ Frontend has `description?` field - remove or mark as deprecated
- ✅ Backend doesn't need changes
- 📝 Can add in future with schema migration

---

### **10. Missing Timestamps in Frontend**

**Decision:** Add `createdAt` (and `updatedAt` where appropriate) to all DTOs

**Rationale:**
- Useful for sorting and display
- Available from database
- Small payload increase for better UX
- Standard practice for entities

**Impact:**
- ✅ All DTOs now include `createdAt` as ISO string
- ✅ Frontend can display "2 hours ago" etc.
- ✅ Message lists can sort by creation time
- ✅ Insights can show age

---

## 📦 **Package Structure**

```
packages/types/
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── README.md              # Package documentation
└── src/
    ├── enums.ts           # Shared enums and constants
    ├── entities.ts        # Database entity types
    ├── dtos.ts            # API DTO types
    ├── utils.ts           # Transformation utilities
    └── index.ts           # Main exports
```

---

## ✅ **Alignment Summary**

| Type | Frontend Before | Backend | Shared Types Decision |
|------|----------------|---------|----------------------|
| **User.role** | ❌ Missing | ✅ Has | ✅ Added to all user types |
| **TeamMember.teamRole** | ❌ Has 'role' | ✅ Has 'teamRole' | ✅ Both fields in DTO |
| **TeamMember 'owner' role** | ❌ Missing | ✅ Has | ✅ Added to enum |
| **AIInsight.type** | 'action-item' | string | ✅ Changed to 'action' |
| **AIInsight.priority** | In metadata | Separate field | ✅ Top-level field |
| **AIInsight.tags** | In metadata | Separate field | ✅ Top-level field |
| **Message.authorId** | string \| 'agent' | string | ✅ Always string (user ID) |
| **Dates** | ISO strings | Date objects | ✅ Both (entities vs DTOs) |
| **JSON fields** | Typed objects | JSON strings | ✅ Both (entities vs DTOs) |
| **Timestamps** | ❌ Missing | ✅ Has | ✅ Added to all DTOs |

---

## 🚀 **Next Steps**

1. ✅ Shared types package created and built
2. ⏭️ Update backend to import from `@fypai/types`
3. ⏭️ Update frontend to import from `@fypai/types`
4. ⏭️ Update backend Prisma schema (if needed for AIInsight types)
5. ⏭️ Update frontend stores to match new types
6. ⏭️ Add transformation layer in backend controllers
7. ⏭️ Test API with aligned types
