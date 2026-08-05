// ============================================
// 认证系统：用户管理、登录、注册、权限控制
// ============================================

const AUTH_STORAGE_KEY = 'data_security_users';
const SESSION_KEY = 'data_security_session';

// 角色定义
const ROLES = {
    ADMIN: { key: 'admin', name: '系统管理员', permissions: ['all'] },
    LEADER: { key: 'leader', name: '评估组长', permissions: ['create', 'edit', 'delete', 'manage_projects', 'manage_risks'] },
    EVALUATOR: { key: 'evaluator', name: '一般评估人员', permissions: ['edit', 'manage_risks'] }
};

const DEFAULT_ADMIN = {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: '系统管理员',
    createdAt: Date.now()
};

// 密码哈希（使用简单哈希，前端存储场景足够）
async function hashPassword(password) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (e) {
        // Fallback: simple hash if crypto.subtle not available
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
}

// 用户存储
function getUsers() {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!data) {
        // 首次加载，初始化默认管理员
        const defaultUsers = [DEFAULT_ADMIN];
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaultUsers));
        return defaultUsers;
    }
    return JSON.parse(data);
}

function saveUsers(users) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

// 会话管理
function getCurrentUser() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    try {
        return JSON.parse(sessionData);
    } catch (e) {
        return null;
    }
}

function setSession(user) {
    const sessionUser = { id: user.id, username: user.username, role: user.role, name: user.name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// 登录
async function login(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
        return { success: false, message: '用户不存在' };
    }
    // 验证密码
    const hashedInput = await hashPassword(password);
    if (user.password !== hashedInput && user.password !== password) {
        // 兼容旧的明文密码存储
        return { success: false, message: '密码错误' };
    }
    // 更新为哈希密码
    if (user.password === password) {
        user.password = hashedInput;
        saveUsers(users);
    }
    setSession(user);
    return { success: true, user: { id: user.id, username: user.username, role: user.role, name: user.name } };
}

// 注册
async function register(username, password, name, role) {
    const users = getUsers();
    if (users.find(u => u.username === username)) {
        return { success: false, message: '用户名已存在' };
    }
    if (!password || password.length < 6) {
        return { success: false, message: '密码至少6位' };
    }
    if (!name) {
        return { success: false, message: '请填写姓名' };
    }
    if (role === 'admin') {
        return { success: false, message: '系统管理员角色不可通过注册创建' };
    }
    
    const hashedPassword = await hashPassword(password);
    const newUser = {
        id: Date.now().toString(),
        username: username,
        password: hashedPassword,
        name: name,
        role: role || 'evaluator',
        createdAt: Date.now()
    };
    users.push(newUser);
    saveUsers(users);
    return { success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name } };
}

// 登出
function logout() {
    clearSession();
}

// 权限检查
function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const role = ROLES[user.role.toUpperCase()];
    if (!role) return false;
    return role.permissions.includes('all') || role.permissions.includes(permission);
}

function requirePermission(permission, actionName) {
    if (!hasPermission(permission)) {
        alert(`您没有${actionName || '执行此操作'}的权限！需要更高的角色权限。`);
        return false;
    }
    return true;
}

// 用户管理（管理员功能）
function getAllUsers() {
    return getUsers().map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt
    }));
}

function updateUserRole(userId, newRole) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    if (user.id === 'admin') return { success: false, message: '默认管理员角色不可修改' };
    if (newRole === 'admin') return { success: false, message: '系统管理员角色不可通过界面设置' };
    user.role = newRole;
    saveUsers(users);
    return { success: true };
}

function updateUserName(userId, newName) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    user.name = newName;
    saveUsers(users);
    return { success: true };
}

async function changeUserPassword(userId, oldPassword, newPassword) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    
    const currentUser = getCurrentUser();
    if (currentUser.id !== userId && !hasPermission('all')) {
        return { success: false, message: '无权修改此用户密码' };
    }
    
    if (currentUser.id === userId) {
        const hashedOld = await hashPassword(oldPassword);
        if (user.password !== hashedOld && user.password !== oldPassword) {
            return { success: false, message: '原密码错误' };
        }
    }
    
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: '新密码至少6位' };
    }
    
    user.password = await hashPassword(newPassword);
    saveUsers(users);
    return { success: true };
}

function deleteUser(userId) {
    if (userId === 'admin') return { success: false, message: '不能删除默认管理员' };
    const users = getUsers();
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        return { success: false, message: '不能删除自己的账户' };
    }
    const filtered = users.filter(u => u.id !== userId);
    saveUsers(filtered);
    return { success: true };
}

function resetUserPassword(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: '用户不存在' };
    const newPassword = '123456';
    hashPassword(newPassword).then(hashed => {
        user.password = hashed;
        saveUsers(users);
    });
    return { success: true, message: `密码已重置为: ${newPassword}` };
}

// 获取角色名称
function getRoleName(roleKey) {
    const role = ROLES[roleKey.toUpperCase()];
    return role ? role.name : '未知角色';
}

// 确保默认管理员存在
function ensureDefaultAdmin() {
    const users = getUsers();
    if (!users.find(u => u.username === 'admin')) {
        users.push(DEFAULT_ADMIN);
        saveUsers(users);
    }
}
