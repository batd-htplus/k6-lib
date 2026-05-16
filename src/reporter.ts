/**
 * Legacy reporter module — re-exports from the new reporter modules.
 *
 * Provided for backward compatibility so existing imports from `@htplus/k6-lib/reporter` continue to work.
 */
export { handleSummary, generateSummary } from './reporter/handle-summary';
export { generateJUnitXml } from './reporter/junit-xml';
