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
export var UserRole;
(function (UserRole) {
    UserRole["MEMBER"] = "member";
    UserRole["ADMIN"] = "admin";
    UserRole["AGENT"] = "agent";
})(UserRole || (UserRole = {}));
/**
 * Team Role Enum
 * Defines a user's role within a specific team
 */
export var TeamRole;
(function (TeamRole) {
    TeamRole["OWNER"] = "owner";
    TeamRole["ADMIN"] = "admin";
    TeamRole["MEMBER"] = "member";
})(TeamRole || (TeamRole = {}));
/**
 * Content Type Enum
 * Defines the type of message content
 */
export var ContentType;
(function (ContentType) {
    ContentType["TEXT"] = "text";
    ContentType["AI_LONGFORM"] = "ai_longform";
    ContentType["NOTEBOOK"] = "notebook";
    ContentType["FILE"] = "file";
})(ContentType || (ContentType = {}));
/**
 * AI Insight Type Enum
 * Defines the type of AI-generated insight
 *
 * DECISION: Use 'action' instead of 'action-item' for consistency
 * Backend will use snake_case in DB, but expose as enum value
 */
export var InsightType;
(function (InsightType) {
    InsightType["SUMMARY"] = "summary";
    InsightType["ACTION"] = "action";
    InsightType["SUGGESTION"] = "suggestion";
    InsightType["ANALYSIS"] = "analysis";
    InsightType["CODE"] = "code";
    InsightType["DOCUMENT"] = "document";
})(InsightType || (InsightType = {}));
/**
 * Priority Level Enum
 * Defines priority levels for insights and tasks
 */
export var Priority;
(function (Priority) {
    Priority["LOW"] = "low";
    Priority["MEDIUM"] = "medium";
    Priority["HIGH"] = "high";
})(Priority || (Priority = {}));
/**
 * Helper function to validate enum values
 */
export function isValidUserRole(value) {
    return Object.values(UserRole).includes(value);
}
export function isValidTeamRole(value) {
    return Object.values(TeamRole).includes(value);
}
export function isValidContentType(value) {
    return Object.values(ContentType).includes(value);
}
export function isValidInsightType(value) {
    return Object.values(InsightType).includes(value);
}
export function isValidPriority(value) {
    return Object.values(Priority).includes(value);
}
