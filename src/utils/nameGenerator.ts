import { FormField, NameGeneratorFormat } from '../core/schemaTypes';

/** Simple in-memory counter for generated IDs (per session). In production, this would come from API/DB. */
let sessionIdCounter = 1;

/** Reset counter (for testing or new form load) */
export function resetNameGeneratorCounter(): void {
    sessionIdCounter = 1;
}

/** Get next ID and increment counter */
function getNextId(padding: number): string {
    const id = String(sessionIdCounter).padStart(Math.max(1, padding), '0');
    sessionIdCounter += 1;
    return id;
}

/** Get random 4-digit string */
function getRandom4(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
}

/** Get current year (e.g. 2026) */
function getYear(): string {
    return String(new Date().getFullYear());
}

/** Get current month (e.g. 03) */
function getMonth(): string {
    return String(new Date().getMonth() + 1).padStart(2, '0');
}

/** Get current day (e.g. 17) */
function getDay(): string {
    return String(new Date().getDate()).padStart(2, '0');
}

/** Get year-month (e.g. 202603) */
function getYearMonth(): string {
    return getYear() + getMonth();
}

/** Get year-month-day (e.g. 2026-03-17) */
function getYearMonthDay(): string {
    return `${getYear()}-${getMonth()}-${getDay()}`;
}

/**
 * Generate a name based on field configuration.
 * Uses format, prefix, suffix, static text, and padded ID.
 * For USER_INPUT formats, uses empty string as placeholder (caller should pass userInput).
 */
export function generateName(
    fieldConfig: Pick<
        FormField,
        | 'nameGeneratorFormat'
        | 'nameGeneratorText'
        | 'nameGeneratorPrefix'
        | 'nameGeneratorSuffix'
        | 'nameGeneratorIdPadding'
    >,
    userInput?: string
): string {
    const format: NameGeneratorFormat = fieldConfig.nameGeneratorFormat ?? 'TEXT_ID';
    const text = fieldConfig.nameGeneratorText?.trim() || 'RFQ';
    const prefix = fieldConfig.nameGeneratorPrefix ?? '';
    const suffix = fieldConfig.nameGeneratorSuffix ?? '';
    const padding = Math.max(1, fieldConfig.nameGeneratorIdPadding ?? 4);
    const id = getNextId(padding);
    const userVal = userInput ?? '';

    const sep = {
        hyphen: '-',
        underscore: '_',
        slash: '/'
    };

    switch (format) {
        case 'TEXT_HYPHEN_ID':
            return `${text}${sep.hyphen}${id}`;
        case 'TEXT_UNDERSCORE_ID':
            return `${text}${sep.underscore}${id}`;
        case 'TEXT_SLASH_ID':
            return `${text}${sep.slash}${id}`;
        case 'TEXT_ID':
            return `${text}${id}`;
        case 'ID_HYPHEN_TEXT':
            return `${id}${sep.hyphen}${text}`;
        case 'ID_UNDERSCORE_TEXT':
            return `${id}${sep.underscore}${text}`;
        case 'TEXT_YEAR_ID':
            return `${text}${sep.hyphen}${getYear()}${sep.hyphen}${id}`;
        case 'TEXT_MONTH_ID':
            return `${text}${sep.hyphen}${getMonth()}${sep.hyphen}${id}`;
        case 'TEXT_YEAR_MONTH_ID':
            return `${text}${sep.hyphen}${getYearMonth()}${sep.hyphen}${id}`;
        case 'TEXT_ACCOUNT_CODE_ID':
            return `${text}${sep.hyphen}AccountCode${sep.hyphen}${id}`;
        case 'TEXT_BRANCH_ID':
            return `${text}${sep.hyphen}Branch${sep.hyphen}${id}`;
        case 'PREFIX_TEXT_ID':
            return `${prefix || 'CRM'}${sep.hyphen}${text}${sep.hyphen}${id}`;
        case 'TEXT_ID_SUFFIX':
            return `${text}${sep.hyphen}${id}${sep.hyphen}${suffix || 'IND'}`;
        case 'TEXT_RANDOM_4':
            return `${text}${sep.hyphen}${getRandom4()}`;
        case 'TEXT_YEAR_MONTH_DAY_ID':
            return `${text}${sep.hyphen}${getYearMonthDay()}${sep.hyphen}${id}`;
        case 'TEXT_HYPHEN_USER_INPUT':
            return `${text}${sep.hyphen}${userVal || 'P001'}`;
        case 'TEXT_UNDERSCORE_USER_INPUT':
            return `${text}${sep.underscore}${userVal || 'P001'}`;
        case 'TEXT_SLASH_USER_INPUT':
            return `${text}${sep.slash}${userVal || 'P001'}`;
        case 'USER_INPUT_HYPHEN_TEXT':
            return `${userVal || 'P001'}${sep.hyphen}${text}`;
        case 'USER_INPUT_UNDERSCORE_TEXT':
            return `${userVal || 'P001'}${sep.underscore}${text}`;
        default:
            return `${text}${id}`;
    }
}
