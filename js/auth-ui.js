// ============================================
// 认证UI：登录、注册、用户管理、权限控制
// ============================================

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        errorEl.classList.add('show');
        return;
    }
    
    errorEl.classList.remove('show');
    
    const result = await login(username, password);
    if (result.success) {
        onLoginSuccess(result.user);
    } else {
        errorEl.textContent = result.message;
        errorEl.classList.add('show');
    }
}

function onLoginSuccess(user) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('headerUser').style.display = 'flex';
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('userRoleTag').textContent = getRoleName(user.role);
    
    // 权限控制
    updateUIPermissions(user.role);
    
    // 如果在项目页面，重新加载项目
    if (currentProjectId) {
        openProject(currentProjectId);
    } else {
        renderProjectList();
    }
}

function updateUIPermissions(role) {
    const isAdmin = role === 'admin';
    const isLeader = role === 'leader';
    
    // 新建项目按钮 - 组长和管理员可见
    document.getElementById('newProjectBtn').style.display = (isAdmin || isLeader) ? 'inline-block' : 'none';
    
    // 用户管理按钮 - 仅管理员可见
    document.getElementById('userMgmtBtn').style.display = isAdmin ? 'inline-block' : 'none';
    
    // 隐藏项目页面的删除和新建按钮
    const deleteBtn = document.querySelector('button[onclick="deleteCurrentProject()"]');
    if (deleteBtn) deleteBtn.style.display = (isAdmin || isLeader) ? '' : 'none';
    
    // 隐藏项目页面的批量删除
    const batchDeleteBtn = document.querySelector('button[onclick="batchDeleteProjects()"]');
    if (batchDeleteBtn) batchDeleteBtn.style.display = (isAdmin || isLeader) ? '' : 'none';
    
    // 隐藏创建项目按钮
    const createProjectBtn = document.querySelector('button[onclick="showCreateProjectModal()"]');
    if (createProjectBtn && createProjectBtn.closest('.header') === null) {
        // 如果在项目页面有另一个创建按钮
    }
    
    // 设置评估人员自动填充
    if (isAdmin || isLeader) {
        // 可以设置评估人员
    }
}

function doLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    logout();
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('headerUser').style.display = 'none';
    
    // 重置表单
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.remove('show');
    
    // 如果在项目视图，返回仪表盘
    if (currentProjectId) {
        backToDashboard();
    }
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'flex';
    // 清空表单
    ['regUsername', 'regName', 'regPassword', 'regConfirm'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const name = document.getElementById('regName').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const role = document.getElementById('regRole').value;
    
    if (!username || !name || !password) {
        alert('请填写所有必填字段！');
        return;
    }
    if (password !== confirm) {
        alert('两次输入的密码不一致！');
        return;
    }
    
    const result = await register(username, password, name, role);
    if (result.success) {
        alert('注册成功！请登录');
        document.getElementById('registerModal').style.display = 'none';
        document.getElementById('loginUsername').value = username;
    } else {
        alert('注册失败：' + result.message);
    }
}

// 视图切换
function switchView(viewId) {
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('projectView').style.display = 'none';
    document.getElementById(viewId).style.display = 'block';
}

// 用户管理 - 跳转到独立页面
function showUserManagement() {
    if (!requirePermission('all', '管理用户')) return;
    window.location.href = 'user-management.html';
}

function backFromUserManagement() {
    window.location.href = 'index.html';
}

function renderUserTable() {
    const users = getAllUsers();
    const tbody = document.getElementById('userMgmtTableBody');
    const currentUser = getCurrentUser();
    document.getElementById('totalUserCount').textContent = users.length;

    let html = '';
    users.forEach(user => {
        const roleClass = 'role-' + user.role;
        const roleName = getRoleName(user.role);
        const isAdminAccount = user.id === 'admin';
        const isCurrentUser = user.id === currentUser.id;
        const canDelete = !isAdminAccount && !isCurrentUser;
        const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-';
        const canChangeRole = !isAdminAccount && !isCurrentUser;

        html += `
            <tr id="user-row-${user.id}" data-user-id="${user.id}">
                <td class="td-name">${escapeHtml(user.name)}</td>
                <td>@${escapeHtml(user.username)}</td>
                <td>
                    ${isAdminAccount ? 
                        '<span class="role-badge role-admin">系统管理员</span>' :
                        `<select onchange="changeUserRole('${user.id}', this.value)" ${canChangeRole ? '' : 'disabled'}>
                            <option value="evaluator" ${user.role === 'evaluator' ? 'selected' : ''}>一般评估人员</option>
                            <option value="leader" ${user.role === 'leader' ? 'selected' : ''}>评估组长</option>
                        </select>`
                    }
                </td>
                <td>${dateStr}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-primary" onclick="editUserName('${user.id}')">编辑姓名</button>
                        <button class="btn btn-sm btn-warning" onclick="resetUserPwd('${user.id}')" ${isAdminAccount ? 'disabled' : ''}>重置密码</button>
                        <button class="btn btn-sm btn-danger" onclick="removeUser('${user.id}')" ${!canDelete ? 'disabled' : ''}>删除</button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function editUserName(userId) {
    const row = document.getElementById(`user-row-${userId}`);
    const nameCell = row.querySelector('.td-name');
    const currentName = nameCell.textContent.trim();
    nameCell.innerHTML = `<div class="edit-field"><input type="text" id="editNameInput" value="${escapeHtml(currentName)}" style="width:130px;"><button class="btn btn-sm btn-primary" onclick="saveUserName('${userId}')">保存</button><button class="btn btn-sm btn-default" onclick="renderUserTable()">取消</button></div>`;
    row.classList.add('row-editing');
    document.getElementById('editNameInput').focus();
    document.getElementById('editNameInput').select();
}

function saveUserName(userId) {
    const newName = document.getElementById('editNameInput').value.trim();
    if (!newName) {
        alert('姓名不能为空！');
        return;
    }
    const result = updateUserName(userId, newName);
    if (result.success) {
        renderUserTable();
    } else {
        alert(result.message);
    }
}

function changeUserRole(userId, newRole) {
    if (newRole === 'admin') {
        alert('系统管理员角色不可通过界面设置！');
        renderUserTable();
        return;
    }
    const result = updateUserRole(userId, newRole);
    if (!result.success) {
        alert(result.message);
        renderUserTable();
        return;
    }
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        const freshUser = getUsers().find(u => u.id === userId);
        if (freshUser) {
            setSession(freshUser);
            onLoginSuccess({ id: freshUser.id, username: freshUser.username, role: freshUser.role, name: freshUser.name });
        }
    }
    renderUserTable();
}

function removeUser(userId) {
    if (!confirm('确定要删除此用户吗？此操作不可恢复！')) return;
    const result = deleteUser(userId);
    if (result.success) {
        renderUserTable();
    } else {
        alert(result.message);
    }
}

function resetUserPwd(userId) {
    if (!confirm('确定要重置此用户密码为"123456"吗？')) return;
    const result = resetUserPassword(userId);
    alert(result.message);
}

async function addNewUser() {
    const username = document.getElementById('newUserUsername').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    if (!username || !name || !password) {
        alert('请填写所有字段！');
        return;
    }

    const result = await register(username, password, name, role);
    if (result.success) {
        alert('添加成功！');
        ['newUserUsername', 'newUserName', 'newUserPassword'].forEach(id => {
            document.getElementById(id).value = '';
        });
        renderUserTable();
    } else {
        alert('添加失败：' + result.message);
    }
}

// 修改密码
function showChangePassword() {
    document.getElementById('changePwdModal').style.display = 'flex';
    ['oldPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

async function handleChangePassword() {
    const oldPwd = document.getElementById('oldPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const user = getCurrentUser();
    
    if (!oldPwd || !newPwd) {
        alert('请填写完整！');
        return;
    }
    if (newPwd !== confirmPwd) {
        alert('两次输入的新密码不一致！');
        return;
    }
    
    const result = await changeUserPassword(user.id, oldPwd, newPwd);
    if (result.success) {
        alert('密码修改成功！');
        document.getElementById('changePwdModal').style.display = 'none';
    } else {
        alert(result.message);
    }
}

// 初始化认证状态
function initAuth() {
    ensureDefaultAdmin();
    
    const user = getCurrentUser();
    if (user) {
        onLoginSuccess(user);
    } else {
        // 显示登录页
        document.getElementById('loginPage').style.display = 'flex';
    }
}

// 权限检查包装器
function checkPermissionAndWarn(permission, actionName) {
    if (!hasPermission(permission)) {
        alert(`您没有权限执行"${actionName}"操作。需要"${getRoleName(permission === 'create' ? 'leader' : permission === 'delete' ? 'leader' : 'admin')}"角色权限。`);
        return false;
    }
    return true;
}
