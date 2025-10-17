/**
 * Shared Enums and Constants
 *
 * These enums define the allowed values for various fields across the application.
 * They ensure type safety and consistency between frontend and backend.
 */
/**
 * User Role Enum
 * Defines the application-level role of a user
 */
export declare enum UserRole {
    MEMBER = "member",
    ADMIN = "admin",
    AGENT = "agent"
}
/**
 * Team Role Enum
 * Defines a user's role within a specific team
 */
export declare enum TeamRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member"
}
/**
 * Content Type Enum
 * Defines the type of message content
 */
export declare enum ContentType {
    TEXT = "text",
    AI_LONGFORM = "ai_longform",
    NOTEBOOK = "notebook",
    FILE = "file"
}
/**
 * AI Insight Type Enum
 * Defines the type of AI-generated insight
 *
 * DECISION: Use 'action' instead of 'action-item' for consistency
 * Backend will use snake_case in DB, but expose as enum value
 */
export declare enum InsightType {
    SUMMARY = "summary",
    ACTION = "action",
    SUGGESTION = "suggestion",
    ANALYSIS = "analysis",
    CODE = "code",
    DOCUMENT = "document"
}
/**
 * Priority Level Enum
 * Defines priority levels for insights and tasks
 */
export declare enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
/**
 * Union type alternatives for when you need string literals
 * Useful for API contracts and validation
 */
export type UserRoleString = 'member' | 'admin' | 'agent';
export type TeamRoleString = 'owner' | 'admin' | 'member';
export type ContentTypeString = 'text' | 'ai_longform' | 'notebook' | 'file';
export type InsightTypeString = 'summary' | 'action' | 'suggestion' | 'analysis' | 'code' | 'document';
export type PriorityString = 'low' | 'medium' | 'high';
/**
 * Helper function to validate enum values
 */
export declare function isValidUserRole(value: string): value is UserRoleString;
export declare function isValidTeamRole(value: string): value is TeamRoleString;
export declare function isValidContentType(value: string): value is ContentTypeString;
export declare function isValidInsightType(value: string): value is InsightTypeString;
export declare function isValidPriority(value: string): value is PriorityString;
//# sourceMappingURL=enums.d.ts.map