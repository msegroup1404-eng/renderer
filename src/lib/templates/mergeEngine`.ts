import { TemplateSnapshot } from '@/templates/types';
import deepmerge from 'deepmerge';

// Cache for normalized templates to avoid re-processing
const templateCache = new WeakMap<object, TemplateSnapshot>();

// Memoized normalizer with caching
function normalizeTemplate(template: any): TemplateSnapshot {
  if (templateCache.has(template)) {
    return templateCache.get(template)!;
  }
  
  const normalized: TemplateSnapshot = {
    id: template.id || 'tem123',
    name: template.name || '',
    version: template.version || '0.0',
    updatedAt: template.updatedAt || new Date().toISOString(), // Faster than toString()
    content: template.content || [],
    root: template.root || { props: template.tokens || {} },
  };
  
  templateCache.set(template, normalized);
  return normalized;
}

// Optimized defaults application using iterative BFS instead of recursion
function applyDefaults(data: TemplateSnapshot, defaults: Record<string, any> = {}) {
  if (Object.keys(defaults).length === 0) return;
  
  // Use a stack for iterative traversal (faster than recursion for deep structures)
  const stack: Array<{ props: any }> = [];
  
  // Process root props first
  if (data.root?.props) {
    stack.push({ props: data.root.props });
  }
  
  // Process content items
  for (const item of data.content) {
    const defaultProps = defaults[item.type];
    if (defaultProps && item.props) {
      // Merge defaults ONCE at the start
      item.props = Object.assign({}, defaultProps, item.props);
      if (item.props) {
        stack.push({ props: item.props });
      }
    } else if (defaultProps) {
      item.props = { ...defaultProps };
    }
  }
  
  // Process nested props iteratively
  while (stack.length > 0) {
    const current = stack.pop()!;
    
    for (const key in current.props) {
      const val = current.props[key];
      
      // Check if it's an array of configurable items
      if (Array.isArray(val) && val.length > 0) {
        const firstItem = val[0];
        
        // Fast type check using duck typing
        if (firstItem && typeof firstItem === 'object' && 'type' in firstItem && 'props' in firstItem) {
          for (const item of val) {
            const defaultProps = defaults[item.type];
            if (defaultProps && item.props) {
              // Merge defaults once
              item.props = Object.assign({}, defaultProps, item.props);
              stack.push({ props: item.props });
            } else if (defaultProps) {
              item.props = { ...defaultProps };
            }
          }
        }
      }
    }
  }
}

// Optimized array merge with early returns and better ID handling
function arrayMerge(dest: any[], src: any[]): any[] {
  const srcLen = src.length;
  const destLen = dest?.length || 0;
  
  // Fast paths for common cases
  if (srcLen === 0) return dest || [];
  if (destLen === 0) return src;
  
  // Check if we should do ID-based merging
  let hasIds = false;
  for (let i = 0; i < srcLen; i++) {
    const item = src[i];
    if (item.id || item.props?.id) {
      hasIds = true;
      break; // Early exit once we find one ID
    }
  }
  
  if (!hasIds) {
    // Simple index-based merge for small arrays
    const maxLen = Math.max(destLen, srcLen);
    const result = new Array(maxLen);
    
    for (let i = 0; i < maxLen; i++) {
      if (i < srcLen) {
        result[i] = i < destLen 
          ? deepmerge(dest[i], src[i], { arrayMerge })
          : src[i];
      } else {
        result[i] = dest[i];
      }
    }
    return result;
  }
  
  // ID-based merge with Map optimization
  const map = new Map();
  
  // Pre-allocate array for faster iteration
  for (let i = 0; i < destLen; i++) {
    const item = dest[i];
    const id = item.props?.id || item.id;
    if (id) {
      map.set(id, item);
    }
  }
  
  const result = [];
  const processedIds = new Set();
  
  // Merge existing items
  for (let i = 0; i < srcLen; i++) {
    const srcItem = src[i];
    const id = srcItem.props?.id || srcItem.id;
    
    if (id) {
      processedIds.add(id);
      const destItem = map.get(id);
      result.push(destItem 
        ? deepmerge(destItem, srcItem, { arrayMerge })
        : srcItem
      );
    } else {
      result.push(srcItem);
    }
  }
  
  // Add remaining dest items that weren't in src
  for (const [id, item] of map) {
    if (!processedIds.has(id)) {
      result.push(item);
    }
  }
  
  return result;
}

// Cache for merged results based on input signatures
const mergeCache = new Map<string, TemplateSnapshot>();

function getCacheKey(base: any, tenant: any, page: any): string {
  // Simple hash - in production use a proper hash function
  return `${JSON.stringify(base?.id)}|${JSON.stringify(tenant)}|${JSON.stringify(page)}`;
}

export function mergeTemplateWithPage(
  baseTemplate: any, 
  tenantOverrides: any, 
  pageOverrides: any
): TemplateSnapshot {
  
  // Check cache first
  const cacheKey = getCacheKey(baseTemplate, tenantOverrides, pageOverrides);
  if (mergeCache.has(cacheKey)) {
    return mergeCache.get(cacheKey)!;
  }
  
  const normalized = normalizeTemplate(baseTemplate);
  
  // Optimized override processing - avoid unnecessary allocations
  let processedTenantOverrides = tenantOverrides;
  if (processedTenantOverrides && !processedTenantOverrides.root && !processedTenantOverrides.content) {
    processedTenantOverrides = { 
      root: { 
        props: processedTenantOverrides 
      } 
    };
  }
  
  // Use two-step merge instead of deepmerge.all for better control
  const merged1 = deepmerge(normalized, processedTenantOverrides || {}, { arrayMerge });
  const merged = deepmerge(merged1, pageOverrides || {}, { arrayMerge }) as TemplateSnapshot;
  
  // Apply defaults
  const defaults = baseTemplate.defaults;
  if (defaults && Object.keys(defaults).length > 0) {
    applyDefaults(merged, defaults);
  }
  
  // Cache the result
  if (mergeCache.size > 100) {
    // Limit cache size to prevent memory leaks
    const firstKey = mergeCache.keys().next().value;
    mergeCache.delete(firstKey!);
  }
  mergeCache.set(cacheKey, merged);
  
  return merged;
}