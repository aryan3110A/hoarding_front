// Role-Based Access Control (RBAC) Utility
// Defines permissions and access control for all roles

export type Role = 'owner' | 'manager' | 'sales' | 'designer' | 'fitter' | 'admin';

export interface Permission {
  component: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  notes?: string;
}

export interface RolePermissions {
  [key: string]: {
    [component: string]: Permission;
  };
}

// Complete RBAC permissions matrix
export const rolePermissions: RolePermissions = {
  owner: {
    hoardings: { component: 'hoardings', create: true, read: true, update: true, delete: true },
    bookings: { component: 'bookings', create: true, read: true, update: true, delete: true },
    enquiries: { component: 'enquiries', create: true, read: true, update: true, delete: true },
    contracts: { component: 'contracts', create: true, read: true, update: true, delete: true },
    rentRecords: { component: 'rentRecords', create: true, read: true, update: true, delete: true },
    vendors: { component: 'vendors', create: true, read: true, update: true, delete: true },
    users: { component: 'users', create: true, read: true, update: true, delete: true },
    roles: { component: 'roles', create: true, read: true, update: true, delete: true },
    tasks: { component: 'tasks', create: true, read: true, update: true, delete: true },
    designAssignments: { component: 'designAssignments', create: true, read: true, update: true, delete: true },
    reports: { component: 'reports', create: true, read: true, update: true, delete: true },
    adminSettings: { component: 'adminSettings', create: true, read: true, update: true, delete: true },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true },
    locationTracking: { component: 'locationTracking', create: true, read: true, update: true, delete: true },
  },
  manager: {
    hoardings: { component: 'hoardings', create: true, read: true, update: true, delete: true },
    bookings: { component: 'bookings', create: true, read: true, update: true, delete: true },
    enquiries: { component: 'enquiries', create: true, read: true, update: true, delete: true },
    contracts: { component: 'contracts', create: true, read: true, update: true, delete: true },
    rentRecords: { component: 'rentRecords', create: true, read: true, update: true, delete: true },
    vendors: { component: 'vendors', create: true, read: true, update: true, delete: true },
    users: { component: 'users', create: false, read: true, update: false, delete: false, notes: 'View only' },
    roles: { component: 'roles', create: false, read: true, update: false, delete: false, notes: 'View only' },
    tasks: { component: 'tasks', create: true, read: true, update: true, delete: true },
    designAssignments: { component: 'designAssignments', create: true, read: true, update: true, delete: true },
    reports: { component: 'reports', create: true, read: true, update: true, delete: true },
    adminSettings: { component: 'adminSettings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true },
    locationTracking: { component: 'locationTracking', create: false, read: false, update: false, delete: false, notes: 'No access' },
  },
  sales: {
    hoardings: { component: 'hoardings', create: false, read: true, update: false, delete: false, notes: 'View only' },
    bookings: { component: 'bookings', create: true, read: true, update: true, delete: false, notes: 'Can edit own' },
    enquiries: { component: 'enquiries', create: true, read: true, update: true, delete: false, notes: 'Can edit own' },
    contracts: { component: 'contracts', create: false, read: false, update: false, delete: false, notes: 'No access' },
    rentRecords: { component: 'rentRecords', create: false, read: false, update: false, delete: false, notes: 'No access' },
    vendors: { component: 'vendors', create: false, read: false, update: false, delete: false, notes: 'No access' },
    users: { component: 'users', create: false, read: false, update: false, delete: false, notes: 'No access' },
    roles: { component: 'roles', create: false, read: false, update: false, delete: false, notes: 'No access' },
    tasks: { component: 'tasks', create: false, read: true, update: true, delete: false, notes: 'View assigned only, can update own' },
    designAssignments: { component: 'designAssignments', create: false, read: false, update: false, delete: false, notes: 'No access' },
    reports: { component: 'reports', create: false, read: false, update: false, delete: false, notes: 'No access' },
    adminSettings: { component: 'adminSettings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true, notes: 'Own notifications' },
    locationTracking: { component: 'locationTracking', create: true, read: true, update: true, delete: false, notes: 'Check-in enabled' },
  },
  designer: {
    hoardings: { component: 'hoardings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    bookings: { component: 'bookings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    enquiries: { component: 'enquiries', create: false, read: false, update: false, delete: false, notes: 'No access' },
    contracts: { component: 'contracts', create: false, read: false, update: false, delete: false, notes: 'No access' },
    rentRecords: { component: 'rentRecords', create: false, read: false, update: false, delete: false, notes: 'No access' },
    vendors: { component: 'vendors', create: false, read: false, update: false, delete: false, notes: 'No access' },
    users: { component: 'users', create: false, read: false, update: false, delete: false, notes: 'No access' },
    roles: { component: 'roles', create: false, read: false, update: false, delete: false, notes: 'No access' },
    tasks: { component: 'tasks', create: false, read: true, update: true, delete: false, notes: 'Design tasks only, can update own' },
    designAssignments: { component: 'designAssignments', create: false, read: true, update: true, delete: false, notes: 'Own assignments' },
    reports: { component: 'reports', create: false, read: false, update: false, delete: false, notes: 'No access' },
    adminSettings: { component: 'adminSettings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true, notes: 'Own notifications' },
    locationTracking: { component: 'locationTracking', create: false, read: false, update: false, delete: false, notes: 'No access' },
  },
  fitter: {
    // Spec adjustment: Fitter should NOT access hoarding master list; only sees assigned jobs via tasks
    hoardings: { component: 'hoardings', create: false, read: false, update: false, delete: false, notes: 'No direct list access' },
    bookings: { component: 'bookings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    enquiries: { component: 'enquiries', create: false, read: false, update: false, delete: false, notes: 'No access' },
    contracts: { component: 'contracts', create: false, read: false, update: false, delete: false, notes: 'No access' },
    rentRecords: { component: 'rentRecords', create: false, read: false, update: false, delete: false, notes: 'No access' },
    vendors: { component: 'vendors', create: false, read: false, update: false, delete: false, notes: 'No access' },
    users: { component: 'users', create: false, read: false, update: false, delete: false, notes: 'No access' },
    roles: { component: 'roles', create: false, read: false, update: false, delete: false, notes: 'No access' },
    tasks: { component: 'tasks', create: false, read: true, update: true, delete: false, notes: 'Installation jobs only, can update own status' },
    designAssignments: { component: 'designAssignments', create: false, read: false, update: false, delete: false, notes: 'No access' },
    reports: { component: 'reports', create: false, read: false, update: false, delete: false, notes: 'No access' },
    adminSettings: { component: 'adminSettings', create: false, read: false, update: false, delete: false, notes: 'No access' },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true, notes: 'Own notifications' },
    locationTracking: { component: 'locationTracking', create: true, read: true, update: true, delete: false, notes: 'Check-in enabled' },
  },
  admin: {
    // Admin has same permissions as Owner
    hoardings: { component: 'hoardings', create: true, read: true, update: true, delete: true },
    bookings: { component: 'bookings', create: true, read: true, update: true, delete: true },
    enquiries: { component: 'enquiries', create: true, read: true, update: true, delete: true },
    contracts: { component: 'contracts', create: true, read: true, update: true, delete: true },
    rentRecords: { component: 'rentRecords', create: true, read: true, update: true, delete: true },
    vendors: { component: 'vendors', create: true, read: true, update: true, delete: true },
    users: { component: 'users', create: true, read: true, update: true, delete: true },
    roles: { component: 'roles', create: true, read: true, update: true, delete: true },
    tasks: { component: 'tasks', create: true, read: true, update: true, delete: true },
    designAssignments: { component: 'designAssignments', create: true, read: true, update: true, delete: true },
    reports: { component: 'reports', create: true, read: true, update: true, delete: true },
    adminSettings: { component: 'adminSettings', create: true, read: true, update: true, delete: true },
    notifications: { component: 'notifications', create: true, read: true, update: true, delete: true },
    locationTracking: { component: 'locationTracking', create: true, read: true, update: true, delete: true },
  },
};

// Helper function to extract role from user object
export function getRoleFromUser(user: any): string {
  console.log("🔍 [RBAC] getRoleFromUser called with user:", user);
  
  if (!user) {
    console.log("🔍 [RBAC] No user provided, returning empty string");
    return "";
  }
  
  // Try different possible role properties
  const role = user.role || user.userRole || user.roleName;
  console.log("🔍 [RBAC] Found role property:", role, "Type:", typeof role);
  
  // Handle if role is an object with a name property
  if (role && typeof role === 'object' && role.name) {
    console.log("🔍 [RBAC] Role is object, extracting name:", role.name);
    return role.name;
  }
  
  // Handle if role is a string
  if (role && typeof role === 'string') {
    console.log("🔍 [RBAC] Role is string:", role);
    return role;
  }
  
  console.warn("🔍 [RBAC] Could not extract role from user. User keys:", Object.keys(user));
  return "";
}

// Helper functions
export function hasPermission(role: string, component: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
  console.log(`🔐 [RBAC] hasPermission called: role="${role}", component="${component}", action="${action}"`);
  console.log(`🔐 [RBAC] Role type: ${typeof role}, Component type: ${typeof component}`);
  
  // Validate inputs - allow empty string for role but check it's a string type
  if (typeof role !== 'string' || typeof component !== 'string') {
    console.warn(`🔐 [RBAC] Invalid input types - role: ${role} (${typeof role}), component: ${component} (${typeof component})`);
    return false;
  }
  
  // Check if role is empty after trimming
  const trimmedRole = role.trim();
  if (!trimmedRole) {
    console.warn(`🔐 [RBAC] Role is empty or whitespace only: "${role}"`);
    return false;
  }
  
  if (!component.trim()) {
    console.warn(`🔐 [RBAC] Component is empty or whitespace only: "${component}"`);
    return false;
  }
  
  const normalizedRole = trimmedRole.toLowerCase();
  console.log(`🔐 [RBAC] Normalized role: "${normalizedRole}"`);
  
  const permissions = rolePermissions[normalizedRole];
  console.log(`🔐 [RBAC] Permissions for role "${normalizedRole}":`, permissions);
  
  if (!permissions) {
    console.warn(`🔐 [RBAC] No permissions found for role "${normalizedRole}"`);
    console.log(`🔐 [RBAC] Available roles in rolePermissions:`, Object.keys(rolePermissions));
    return false;
  }
  
  if (!permissions[component]) {
    console.warn(`🔐 [RBAC] No permissions found for role "${normalizedRole}" and component "${component}"`);
    console.log(`🔐 [RBAC] Available components for role "${normalizedRole}":`, Object.keys(permissions));
    return false;
  }
  
  const result = permissions[component][action] || false;
  console.log(`🔐 [RBAC] Permission result for "${normalizedRole}" -> "${component}" -> "${action}":`, result);
  console.log(`🔐 [RBAC] Full permission object:`, permissions[component]);
  return result;
}

export function canAccess(role: string, component: string): boolean {
  console.log(`🔐 [RBAC] canAccess called: role="${role}", component="${component}"`);
  const result = hasPermission(role, component, 'read');
  console.log(`🔐 [RBAC] canAccess result:`, result);
  return result;
}

export function canCreate(role: string, component: string): boolean {
  return hasPermission(role, component, 'create');
}

export function canUpdate(role: string, component: string): boolean {
  return hasPermission(role, component, 'update');
}

export function canDelete(role: string, component: string): boolean {
  return hasPermission(role, component, 'delete');
}

// Assignment capabilities
export function canAssignTasks(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'manager', 'admin'].includes(normalizedRole);
}

export function canAssignRoles(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'admin'].includes(normalizedRole);
}

export function canViewRent(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'manager', 'admin'].includes(normalizedRole);
}

// Explicit helper for rent create/update (avoids mismatch bugs in pages)
export function canEditRent(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'manager', 'admin'].includes(normalizedRole);
}

export function canViewReports(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'manager', 'admin'].includes(normalizedRole);
}

export function canAccessLocationTracking(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'sales', 'fitter', 'admin'].includes(normalizedRole);
}

export function canAccessAdminSettings(role: string): boolean {
  const normalizedRole = role?.toLowerCase() || '';
  return ['owner', 'admin'].includes(normalizedRole);
}

// Check if user can edit their own resource
export function canEditOwn(role: string, component: string, userId: string, resourceUserId?: string): boolean {
  if (canUpdate(role, component)) {
    return true; // If they can update all, they can update own
  }
  // For sales, they can edit their own bookings/enquiries
  if (role?.toLowerCase() === 'sales' && ['bookings', 'enquiries'].includes(component)) {
    return userId === resourceUserId;
  }
  return false;
}

// Get role level (for hierarchy checks)
export function getRoleLevel(role: string): number {
  const normalizedRole = role?.toLowerCase() || '';
  const levels: { [key: string]: number } = {
    owner: 5,
    manager: 4,
    sales: 3,
    designer: 2,
    fitter: 2,
    admin: 5,
  };
  return levels[normalizedRole] || 0;
}

// Check if role1 can manage role2
export function canManageRole(role1: string, role2: string): boolean {
  if (!canAssignRoles(role1)) {
    return false;
  }
  return getRoleLevel(role1) > getRoleLevel(role2);
}

