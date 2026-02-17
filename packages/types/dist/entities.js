/**
 * Core Entity Types (Prisma-aligned)
 *
 * These types match the Prisma schema exactly and represent the database structure.
 * Use these types in backend controllers and database operations.
 *
 * Key Design Decisions:
 * - All dates are Date objects (Prisma DateTime)
 * - All nullable fields use `| null` (not `?` optional)
 * - JSON fields are stored as `string | null` (will be parsed in DTOs)
 * - IDs are strings (UUID format)
 * - Only createdAt timestamps (no updatedAt in current schema)
 */
/**
 * Type guards to check if an entity matches the expected structure
 */
export function isUser(obj) {
    return (obj &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        (obj.email === null || typeof obj.email === 'string') &&
        (obj.avatar === null || typeof obj.avatar === 'string') &&
        typeof obj.role === 'string' &&
        obj.createdAt instanceof Date);
}
export function isTeam(obj) {
    return (obj &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        obj.createdAt instanceof Date);
}
export function isMessage(obj) {
    return (obj &&
        typeof obj.id === 'string' &&
        typeof obj.teamId === 'string' &&
        typeof obj.authorId === 'string' &&
        typeof obj.content === 'string' &&
        typeof obj.contentType === 'string' &&
        (obj.metadata === null || typeof obj.metadata === 'string') &&
        obj.createdAt instanceof Date);
}
export function isAIInsight(obj) {
    return (obj &&
        typeof obj.id === 'string' &&
        typeof obj.teamId === 'string' &&
        typeof obj.type === 'string' &&
        typeof obj.title === 'string' &&
        typeof obj.content === 'string' &&
        (obj.priority === null || typeof obj.priority === 'string') &&
        (obj.tags === null || typeof obj.tags === 'string') &&
        obj.createdAt instanceof Date &&
        (obj.relatedMessageIds === null || typeof obj.relatedMessageIds === 'string'));
}
