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
        return user && user.role === 'admin';
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

    async login(username, password) {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        var response = await fetch(baseUrl + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        var data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }
        this.setAuth(data.token, data.user);
        return data.user;
    },

    logout() {
        this.clearAuth();
        this.applyRoleAccess();
        this.updateUserMenu();
        this.updateHeaderLoginButton();
        // Switch back to home tab
        var homeBtn = document.querySelector('.bottom-nav-btn[data-tab="home"]');
        if (homeBtn) homeBtn.click();
        if (window.showToast) window.showToast('ออกจากระบบแล้ว', 'info');
    },

    async verifyToken() {
        var token = this.getToken();
        if (!token) return false;

        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        try {
            var response = await fetch(baseUrl + '/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) {
                this.clearAuth();
                return false;
            }
            var data = await response.json();
            localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
            return true;
        } catch (e) {
            // Server might not be reachable, keep token for later
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
        var isAdmin = this.isAdmin();
        var adminElements = document.querySelectorAll('[data-role="admin"]');

        adminElements.forEach(function(el) {
            if (isAdmin) {
                el.style.display = '';
                el.classList.remove('role-hidden');
            } else {
                el.style.display = 'none';
                el.classList.add('role-hidden');
            }
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
                roleEl.textContent = user.role === 'admin' ? 'Admin' : 'User';
                roleEl.className = 'role-badge ' + (user.role === 'admin' ? 'role-admin' : 'role-user');
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
            return await response.json();
        } catch (e) {
            console.error('loadUsers error:', e);
            return [];
        }
    },

    async addUser(username, password, role, displayName) {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
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
    },

    async deleteUser(username) {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        var response = await fetch(baseUrl + '/api/users/' + encodeURIComponent(username), {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'ลบผู้ใช้ไม่สำเร็จ');
        return data;
    },

    async renderUserList() {
        var container = document.getElementById('users-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:20px;color:#AFB1B6">กำลังโหลด...</div>';

        var users = await this.loadUsers();
        if (users.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#AFB1B6">ไม่พบผู้ใช้</div>';
            return;
        }

        var self = this;
        var html = '';
        users.forEach(function(u) {
            var roleBadge = u.role === 'admin'
                ? '<span class="role-badge role-admin">Admin</span>'
                : '<span class="role-badge role-user">User</span>';

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
