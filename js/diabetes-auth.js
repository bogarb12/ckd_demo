/**
 * Diabetes Tracking App - Authentication Module
 * Handles login, logout, token management, and role-based access.
 */

const Auth = {
    TOKEN_KEY: 'dt_auth_token',
    USER_KEY: 'dt_auth_user',

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
        try {
            var data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    isAdmin() {
        var user = this.getUser();
        return user && (user.role === 'admin' || user.role === 'staff' || user.role === 'researcher');
    },

    isStaff() {
        var user = this.getUser();
        return user && (user.role === 'admin' || user.role === 'staff');
    },

    isResearcher() {
        var user = this.getUser();
        return user && (user.role === 'admin' || user.role === 'researcher');
    },

    isPatient() {
        var user = this.getUser();
        return user && user.role === 'patient';
    },

    getUserRole() {
        var user = this.getUser();
        return user ? user.role : null;
    },

    setAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    clearAuth() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    getAuthHeaders() {
        var token = this.getToken();
        if (token) {
            return { 'Authorization': 'Bearer ' + token };
        }
        return {};
    },

    // Offline user store key (for when server is unavailable)
    OFFLINE_USERS_KEY: 'dt_offline_users',

    // Get offline users (seeded with default admin)
    _getOfflineUsers() {
        try {
            var data = localStorage.getItem(this.OFFLINE_USERS_KEY);
            if (data) return JSON.parse(data);
        } catch (e) { /* ignore */ }
        // Seed default admin (same hash as server's data/users.json: password = admin123)
        var defaultUsers = [{
            username: 'admin',
            password: '$2b$10$o/5uRv0M5vhCnuBQj3fx..u6nHiGjDvxYS45WbOj36LRVmdfSqN0O',
            role: 'admin',
            displayName: 'ผู้ดูแลระบบ'
        }];
        localStorage.setItem(this.OFFLINE_USERS_KEY, JSON.stringify(defaultUsers));
        return defaultUsers;
    },

    _saveOfflineUsers(users) {
        localStorage.setItem(this.OFFLINE_USERS_KEY, JSON.stringify(users));
    },

    async login(username, password) {
        // Try server API first
        var serverOk = false;
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });
            var data = await response.json();
            if (response.ok) {
                this.setAuth(data.token, data.user);
                console.log('[Auth] Server login สำเร็จ');
                return data.user;
            }
            // Server returned error (e.g. 401 wrong password) - only if server is truly up
            if (response.status === 400 || response.status === 401) {
                // Could be server is up but credentials wrong, or could be proxy 401
                // Try offline as fallback
                serverOk = false;
            }
        } catch (e) {
            // Network error / server unreachable
            console.warn('[Auth] Server ไม่ตอบ, ใช้ offline login:', e.message);
            serverOk = false;
        }

        // Fallback: offline login using bcryptjs client-side
        return this._offlineLogin(username, password);
    },

    async _offlineLogin(username, password) {
        var users = this._getOfflineUsers();
        var user = null;
        for (var i = 0; i < users.length; i++) {
            if (users[i].username === username) { user = users[i]; break; }
        }
        if (!user) {
            throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

        // Use bcryptjs browser build (loaded from CDN)
        if (typeof dcodeIO === 'undefined' || !dcodeIO.bcrypt) {
            throw new Error('ไม่สามารถตรวจสอบรหัสผ่านได้ (bcrypt library ไม่พร้อม)');
        }

        var bcryptLib = dcodeIO.bcrypt;
        var valid = await new Promise(function(resolve, reject) {
            bcryptLib.compare(password, user.password, function(err, result) {
                if (err) reject(err);
                else resolve(result);
            });
        });

        if (!valid) {
            throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

        // Create offline token (simple base64 marker)
        var tokenPayload = { username: user.username, role: user.role, displayName: user.displayName, offline: true, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
        var offlineToken = 'offline_' + btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))));

        var userData = { username: user.username, role: user.role, displayName: user.displayName };
        this.setAuth(offlineToken, userData);
        console.log('[Auth] Offline login สำเร็จ (mode: localStorage)');
        return userData;
    },

    logout() {
        this.clearAuth();
        this.applyRoleAccess();
        this.updateUserMenu();
        this.updateHeaderLoginButton();
        // Hide dashboard content and show auth overlay
        var authOverlay = document.getElementById('dashboard-auth-overlay');
        var dashContent = document.getElementById('dashboard-content');
        if (authOverlay) authOverlay.classList.remove('hidden');
        if (dashContent) dashContent.style.display = 'none';
        // Switch back to home tab
        var homeBtn = document.querySelector('.bottom-nav-btn[data-tab="home"]');
        if (homeBtn) homeBtn.click();
        if (window.showToast) window.showToast('ออกจากระบบแล้ว', 'info');
    },

    async verifyToken() {
        var token = this.getToken();
        if (!token) return false;

        // Offline token: check expiry locally
        if (token.indexOf('offline_') === 0) {
            try {
                var payload = JSON.parse(decodeURIComponent(escape(atob(token.substring(8)))));
                if (payload.exp && payload.exp < Date.now()) {
                    this.clearAuth();
                    return false;
                }
                return true;
            } catch (e) {
                this.clearAuth();
                return false;
            }
        }

        // Server token: verify with API
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) {
                if (this.getUser()) {
                    return true;
                }
                this.clearAuth();
                return false;
            }
            var data = await response.json();
            localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
            return true;
        } catch (e) {
            return this.isLoggedIn();
        }
    },

    // ==========================================
    // UI: Login Modal
    // ==========================================

    showLoginModal() {
        var overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        var inputUser = document.getElementById('login-username');
        if (inputUser) inputUser.focus();
    },

    hideLoginModal() {
        var overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        // Clear form
        var errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.style.display = 'none';
    },

    initLoginForm() {
        var self = this;
        var form = document.getElementById('login-form');
        var errorEl = document.getElementById('login-error');
        var btnLogin = document.getElementById('btn-login');
        var inputUser = document.getElementById('login-username');
        var inputPass = document.getElementById('login-password');
        var closeBtn = document.getElementById('login-close');
        var overlay = document.getElementById('login-overlay');

        if (!form) return;

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.hideLoginModal();
            });
        }

        // Click outside to close
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    self.hideLoginModal();
                }
            });
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var username = inputUser.value.trim();
            var password = inputPass.value;

            if (!username || !password) {
                errorEl.textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
                errorEl.style.display = 'block';
                return;
            }

            btnLogin.disabled = true;
            btnLogin.textContent = 'กำลังเข้าสู่ระบบ...';
            errorEl.style.display = 'none';

            try {
                await self.login(username, password);
                self.hideLoginModal();
                self.applyRoleAccess();
                self.updateUserMenu();
                self.updateHeaderLoginButton();
                // Re-init dashboard if currently on dashboard tab
                var dashTab = document.getElementById('tab-dashboard');
                if (dashTab && dashTab.classList.contains('active')) {
                    if (window.DiabetesDashboard) DiabetesDashboard.init();
                }
                if (window.showToast) window.showToast('เข้าสู่ระบบสำเร็จ', 'success');
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.style.display = 'block';
            } finally {
                btnLogin.disabled = false;
                btnLogin.textContent = 'เข้าสู่ระบบ';
            }
        });
    },

    // Header login button
    initHeaderLoginButton() {
        var self = this;
        var btn = document.getElementById('btn-header-login');
        if (!btn) return;

        btn.addEventListener('click', function() {
            self.showLoginModal();
        });

        // Update visibility based on login state
        this.updateHeaderLoginButton();
    },

    updateHeaderLoginButton() {
        var btn = document.getElementById('btn-header-login');
        if (!btn) return;
        btn.style.display = this.isLoggedIn() ? 'none' : 'flex';
    },

    // ==========================================
    // UI: Role-based Access
    // ==========================================

    applyRoleAccess() {
        var self = this;
        var role = this.getUserRole();

        // Role hierarchy: admin sees everything, staff/researcher see specific tabs
        // data-role="admin" → admin, staff, researcher (all non-patient logged-in users)
        // data-role="staff" → admin, staff only
        // data-role="researcher" → admin, researcher only
        var roleChecks = {
            admin: function() { return self.isAdmin(); },
            staff: function() { return self.isStaff(); },
            researcher: function() { return self.isResearcher(); }
        };

        ['admin', 'staff', 'researcher'].forEach(function(r) {
            var elements = document.querySelectorAll('[data-role="' + r + '"]');
            var hasAccess = roleChecks[r]();
            elements.forEach(function(el) {
                if (hasAccess) {
                    el.style.display = '';
                    el.classList.remove('role-hidden');
                } else {
                    el.style.display = 'none';
                    el.classList.add('role-hidden');
                }
            });
        });
    },

    // ==========================================
    // UI: User Menu (Header)
    // ==========================================

    updateUserMenu() {
        var user = this.getUser();
        var menuEl = document.getElementById('user-menu');
        var nameEl = document.getElementById('user-display-name');
        var roleEl = document.getElementById('user-role-badge');
        var logoutBtn = document.getElementById('btn-logout');

        if (!menuEl) return;

        if (user) {
            menuEl.style.display = 'flex';
            if (nameEl) nameEl.textContent = user.displayName || user.username;
            if (roleEl) {
                var roleLabels = { admin: 'Admin', staff: 'เจ้าหน้าที่', researcher: 'นักวิจัย', patient: 'ผู้ป่วย', user: 'User' };
                var roleClasses = { admin: 'role-admin', staff: 'role-staff', researcher: 'role-researcher', patient: 'role-patient', user: 'role-user' };
                roleEl.textContent = roleLabels[user.role] || user.role;
                roleEl.className = 'role-badge ' + (roleClasses[user.role] || 'role-user');
            }
        } else {
            menuEl.style.display = 'none';
        }

        if (logoutBtn) {
            var self = this;
            logoutBtn.onclick = function() {
                self.logout();
            };
        }

        // Also update header login button visibility
        this.updateHeaderLoginButton();
    },

    // ==========================================
    // User Management (Admin)
    // ==========================================

    async loadUsers() {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/users', {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to load users');
            var serverUsers = await response.json();
            // Sync to offline store (without passwords from server)
            return serverUsers;
        } catch (e) {
            console.warn('[Auth] loadUsers: Server ไม่ตอบ, ใช้ offline users');
            // Fallback: offline users (hide password hash)
            var offUsers = this._getOfflineUsers();
            return offUsers.map(function(u) {
                return { username: u.username, role: u.role, displayName: u.displayName, createdAt: u.createdAt || null };
            });
        }
    },

    async addUser(username, password, role, displayName) {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/users', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                body: JSON.stringify({
                    username: username,
                    password: password,
                    role: role,
                    displayName: displayName
                })
            });
            var data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เพิ่มผู้ใช้ไม่สำเร็จ');
            return data;
        } catch (e) {
            // Fallback: add user offline
            return this._addUserOffline(username, password, role, displayName);
        }
    },

    async _addUserOffline(username, password, role, displayName) {
        var users = this._getOfflineUsers();
        for (var i = 0; i < users.length; i++) {
            if (users[i].username === username) throw new Error('ชื่อผู้ใช้ "' + username + '" มีอยู่แล้ว');
        }
        if (typeof dcodeIO === 'undefined' || !dcodeIO.bcrypt) {
            throw new Error('bcrypt library ไม่พร้อม');
        }
        var hash = await new Promise(function(resolve, reject) {
            dcodeIO.bcrypt.hash(password, 10, function(err, h) { if (err) reject(err); else resolve(h); });
        });
        users.push({ username: username, password: hash, role: role, displayName: displayName, createdAt: new Date().toISOString() });
        this._saveOfflineUsers(users);
        console.log('[Auth] เพิ่มผู้ใช้ offline:', username);
        return { message: 'เพิ่มผู้ใช้สำเร็จ (offline mode)' };
    },

    async deleteUser(username) {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/users/' + encodeURIComponent(username), {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            var data = await response.json();
            if (!response.ok) throw new Error(data.error || 'ลบผู้ใช้ไม่สำเร็จ');
            return data;
        } catch (e) {
            // Fallback: delete user offline
            if (username === 'admin') throw new Error('ไม่สามารถลบ admin ได้');
            var users = this._getOfflineUsers();
            var filtered = users.filter(function(u) { return u.username !== username; });
            if (filtered.length === users.length) throw new Error('ไม่พบผู้ใช้');
            this._saveOfflineUsers(filtered);
            console.log('[Auth] ลบผู้ใช้ offline:', username);
            return { message: 'ลบผู้ใช้สำเร็จ (offline mode)' };
        }
    },

    _usersPage: 1,
    _usersPageSize: 10,
    _allUsers: [],

    async renderUserList() {
        var container = document.getElementById('users-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:20px;color:#AFB1B6">กำลังโหลด...</div>';

        var users = await this.loadUsers();
        this._allUsers = users;

        if (users.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#AFB1B6">ไม่พบผู้ใช้</div>';
            return;
        }

        this._renderUserPage(container);
    },

    _renderUserPage(container) {
        if (!container) container = document.getElementById('users-list');
        if (!container) return;

        var self = this;
        var users = this._allUsers;
        var totalPages = Math.ceil(users.length / this._usersPageSize);
        if (this._usersPage > totalPages) this._usersPage = totalPages;

        var startIdx = (this._usersPage - 1) * this._usersPageSize;
        var endIdx = Math.min(startIdx + this._usersPageSize, users.length);
        var pageUsers = users.slice(startIdx, endIdx);

        var html = '';
        pageUsers.forEach(function(u) {
            var roleLabels = { admin: 'Admin', staff: 'เจ้าหน้าที่', researcher: 'นักวิจัย', patient: 'ผู้ป่วย', user: 'User' };
            var roleClasses = { admin: 'role-admin', staff: 'role-staff', researcher: 'role-researcher', patient: 'role-patient', user: 'role-user' };
            var roleBadge = '<span class="role-badge ' + (roleClasses[u.role] || 'role-user') + '">' + (roleLabels[u.role] || u.role) + '</span>';

            var deleteBtn = u.username === 'admin'
                ? ''
                : '<button class="btn-icon btn-delete-user" data-username="' + u.username + '" title="ลบ">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
                  '</button>';

            html += '<div class="user-item">';
            html += '<div class="user-info">';
            html += '<div class="user-name">' + (u.displayName || u.username) + '</div>';
            html += '<div class="user-username">@' + u.username + ' ' + roleBadge + '</div>';
            html += '</div>';
            html += deleteBtn;
            html += '</div>';
        });

        // Add pagination if needed
        if (users.length > this._usersPageSize) {
            html += '<div class="pagination-info" style="margin-top:12px">แสดง ' + (startIdx + 1) + '-' + endIdx + ' จาก ' + users.length + ' ผู้ใช้</div>';
            html += '<div class="pagination">';
            html += '<button class="pagination-btn user-pag-btn" data-page="prev"' + (this._usersPage === 1 ? ' disabled' : '') + '>&laquo;</button>';

            for (var i = 1; i <= totalPages; i++) {
                html += '<button class="pagination-btn user-pag-btn' + (i === this._usersPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
            }

            html += '<button class="pagination-btn user-pag-btn" data-page="next"' + (this._usersPage === totalPages ? ' disabled' : '') + '>&raquo;</button>';
            html += '</div>';
        }

        container.innerHTML = html;

        // Bind delete buttons
        container.querySelectorAll('.btn-delete-user').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var username = this.getAttribute('data-username');
                if (!confirm('ยืนยันลบผู้ใช้ @' + username + ' ?')) return;
                try {
                    await self.deleteUser(username);
                    if (window.showToast) window.showToast('ลบผู้ใช้สำเร็จ', 'success');
                    self.renderUserList();
                } catch (err) {
                    if (window.showToast) window.showToast(err.message, 'error');
                }
            });
        });

        // Bind pagination buttons
        container.querySelectorAll('.user-pag-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var page = this.getAttribute('data-page');
                if (page === 'prev') self._usersPage = Math.max(1, self._usersPage - 1);
                else if (page === 'next') self._usersPage = Math.min(totalPages, self._usersPage + 1);
                else self._usersPage = parseInt(page);
                self._renderUserPage(container);
            });
        });
    },

    initUserManagement() {
        var self = this;
        var btnAdd = document.getElementById('btn-add-user');
        if (!btnAdd) return;

        btnAdd.addEventListener('click', async function() {
            var username = document.getElementById('new-username').value.trim();
            var displayName = document.getElementById('new-displayname').value.trim();
            var password = document.getElementById('new-password').value;
            var role = document.getElementById('new-role').value;

            if (!username || !password) {
                if (window.showToast) window.showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error');
                return;
            }

            btnAdd.disabled = true;
            try {
                await self.addUser(username, password, role, displayName || username);
                if (window.showToast) window.showToast('เพิ่มผู้ใช้สำเร็จ', 'success');
                // Clear form
                document.getElementById('new-username').value = '';
                document.getElementById('new-displayname').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('new-role').value = 'user';
                // Refresh list
                self.renderUserList();
            } catch (err) {
                if (window.showToast) window.showToast(err.message, 'error');
            } finally {
                btnAdd.disabled = false;
            }
        });
    }
};

window.Auth = Auth;
