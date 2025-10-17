/**
 * Type Transformation Utilities
 *
 * These utilities help convert between Entity types (database format) and DTO types (API format).
 *
 * Main transformations:
 * - Date ↔ ISO string
 * - JSON string ↔ Parsed object/array
 * - Entity ↔ DTO
 */
/**
 * Date Utilities
 */
export function dateToISOString(date) {
    return date.toISOString();
}
export function isoStringToDate(iso) {
    return new Date(iso);
}
/**
 * JSON Utilities
 */
export function parseJSON(json) {
    if (json === null)
        return undefined;
    try {
        return JSON.parse(json);
    }
    catch {
        return undefined;
    }
}
export function stringifyJSON(obj) {
    if (obj === undefined || obj === null)
        return null;
    try {
        return JSON.stringify(obj);
    }
    catch {
        return null;
    }
}
/**
 * Enum Utilities
 */
export function enumToString(enumValue) {
    return enumValue;
}
export function stringToEnum(value, enumObj) {
    const enumValue = Object.values(enumObj).find((v) => v === value);
    return enumValue;
}
/**
 * Entity to DTO Transformers
 */
export function userToDTO(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        createdAt: dateToISOString(user.createdAt),
    };
}
export function teamToDTO(team) {
    return {
        id: team.id,
        name: team.name,
        createdAt: dateToISOString(team.createdAt),
    };
}
export function messageToDTO(message, author) {
    return {
        id: message.id,
        teamId: message.teamId,
        authorId: message.authorId,
        content: message.content,
        contentType: message.contentType,
        createdAt: dateToISOString(message.createdAt),
        metadata: parseJSON(message.metadata),
        author: author
            ? {
                id: author.id,
                name: author.name,
                avatar: author.avatar,
                role: author.role,
            }
            : undefined,
    };
}
export function aiInsightToDTO(insight) {
    return {
        id: insight.id,
        teamId: insight.teamId,
        type: insight.type,
        title: insight.title,
        content: insight.content,
        priority: insight.priority ? insight.priority : undefined,
        tags: parseJSON(insight.tags),
        createdAt: dateToISOString(insight.createdAt),
        relatedMessageIds: parseJSON(insight.relatedMessageIds),
    };
}
/**
 * Create TeamWithMembersDTO from Team + TeamMembers + Users
 * This is commonly used when fetching a team with its members
 */
export function teamWithMembersToDTO(team, teamMembers) {
    return {
        id: team.id,
        name: team.name,
        createdAt: dateToISOString(team.createdAt),
        members: teamMembers.map(({ teamMember, user }) => ({
            id: teamMember.id,
            userId: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            teamRole: (teamMember.teamRole || 'member'),
            joinedAt: dateToISOString(teamMember.joinedAt),
        })),
    };
}
/**
 * DTO to Entity Transformers (for request processing)
 */
export function messageDTOToMetadataString(metadata) {
    return stringifyJSON(metadata);
}
export function aiInsightDTOToTagsString(tags) {
    return stringifyJSON(tags);
}
export function aiInsightDTOToRelatedMessageIdsString(ids) {
    return stringifyJSON(ids);
}
/**
 * Batch Transformers
 */
export function usersToDTO(users) {
    return users.map(userToDTO);
}
export function teamsToDTO(teams) {
    return teams.map(teamToDTO);
}
export function messagesToDTO(messages) {
    return messages.map(({ message, author }) => messageToDTO(message, author));
}
export function aiInsightsToDTO(insights) {
    return insights.map(aiInsightToDTO);
}
/**
 * Validation Helpers
 */
export function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
export function isValidISOString(iso) {
    if (typeof iso !== 'string')
        return false;
    const date = new Date(iso);
    return isValidDate(date);
}
export function isValidJSON(json) {
    try {
        JSON.parse(json);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Safe Parsing Helpers (with defaults)
 */
export function parseJSONSafe(json, defaultValue) {
    const parsed = parseJSON(json);
    return parsed !== undefined ? parsed : defaultValue;
}
export function parseISOStringSafe(iso, defaultValue = new Date()) {
    if (!iso)
        return defaultValue;
    try {
        const date = isoStringToDate(iso);
        return isValidDate(date) ? date : defaultValue;
    }
    catch {
        return defaultValue;
    }
}
