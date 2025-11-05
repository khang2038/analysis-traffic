export type AliasMap = Record<string, Record<string, string>>; // propertyId -> alias -> employeeId

export function loadAliasMapFromEnv(): AliasMap {
  const raw = process.env.ALIAS_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as AliasMap;
  } catch {
    return {};
  }
}

export function extractAliasFromPath(pagePathPlusQueryString: string): string {
  // Remove query/hash
  const pathOnly = pagePathPlusQueryString.split('?')[0].split('#')[0];
  // Split and find the last non-empty segment
  const segments = pathOnly.split('/').filter(Boolean);
  if (segments.length === 0) return '';
  const lastSegment = segments[segments.length - 1];
  
  // Extract alias từ cuối slug (sau dấu gạch ngang cuối cùng)
  // Ví dụ: "long-path-bebe" -> "bebe", "something-bebe-bebe" -> "bebe"
  if (lastSegment.includes('-')) {
    const parts = lastSegment.split('-');
    // Lấy phần cuối cùng sau dấu gạch ngang
    return parts[parts.length - 1] || lastSegment;
  }
  
  return lastSegment;
}

export function loadDefaultAliasMapFromEnv(): Record<string, string> {
  const raw = process.env.DEFAULT_ALIAS_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}


