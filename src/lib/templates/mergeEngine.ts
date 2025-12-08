import { TemplateSnapshot } from '@/templates/types';
import { randomUUID } from 'crypto';
import deepmerge from 'deepmerge'

// Optimized normalizer: minimal processing, assumes new slots model
function normalizeTemplate(template: any): TemplateSnapshot {
  return {
    id: template.id || 'tem123',
    name: template.name || '',
    version: template.version || '0.0',
    updatedAt: template.updatedAt || (new Date()).toString(),
    content: template.content || [],
    root: template.root || { props: template.tokens || {} }, // Fold tokens into props, no top-level tokens    // tokens: template.tokens
  };
}

// Apply defaults only if provided; recursive for nested
function applyDefaults(data: TemplateSnapshot, defaults: Record<string, any> = {}) {
  if (Object.keys(defaults).length === 0) return;

  const apply = (props: any) => {
    for (const key in props) {
      const val = props[key];
      if (Array.isArray(val) && val.length > 0 && val[0]?.type && val[0]?.props) {
        val.forEach((item: TemplateSnapshot['content'][number]) => {
          const def = defaults[item.type];
          if (def) item.props = deepmerge(def, item.props || {}); // Defaults first, props override
          apply(item.props);
        });
      }
    }
  };

  data.content.forEach(item => {
    const def = defaults[item.type];
    if (def) item.props = deepmerge(def, item.props || {});
    apply(item.props);
  });

  apply(data.root.props || {});
}

// Custom array merge: optimized for ID-based, recursive for nested slots
function arrayMerge(dest: any[], src: any[]) {
  if (!src.length) return dest || [];
  if (!dest?.length) return src;
  
  // Check if any element has an ID (in props or at root)
  const hasIds = src.some(item => item.id || item.props?.id);
  if (!hasIds) return src;
  
  const map = new Map(dest.map(d => [d.props?.id || d.id, d]));
  for (const s of src) {
    const id = s.props?.id || s.id;
    if (id) {
      const existing = map.get(id) || {};
      map.set(id, deepmerge(existing, s, { arrayMerge }));
    }
  }
  return Array.from(map.values());
}

export function mergeTemplateWithPage(baseTemplate: any, tenantOverrides: any, pageOverrides: any): TemplateSnapshot {
  const normalized = normalizeTemplate(baseTemplate);

  let processedTenantOverrides = tenantOverrides || {};
  if (processedTenantOverrides && !processedTenantOverrides.root && !processedTenantOverrides.content) {
    processedTenantOverrides = { root: { props: processedTenantOverrides } };
  }

  let merged = deepmerge.all([normalized, processedTenantOverrides, pageOverrides || {}], { arrayMerge }) as TemplateSnapshot;

  applyDefaults(merged, baseTemplate.defaults || {});

  return merged;
}