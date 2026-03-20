/**
 * Diabetes Tracking App - Authentication Module
 * Handles login, logout, token management, and role-based access.
 * All data flows through server API (no localStorage for data).
 * Auth token stored in sessionStorage.
 */

const Auth = {
    TOKEN_KEY: 'dt_auth_token',
    USER_KEY: 'dt_auth_user',

    getToken() {
        return sessionStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
        try {
            var data = sessionStorage.getItem(this.USER_KEY);
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
        sessionStorage.setItem(this.TOKEN_KEY, token);
        sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    clearAuth() {
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.USER_KEY);
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
            sessionStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
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

        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.hideLoginModal();
            });
        }

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

        this.updateHeaderLoginButton();
    },

    updateHeaderLoginButton() {
        var btn = document.getElementById('btn-header-login');
        var visitorLabel = document.getElementById('visitor-label');
        var visitorHealth = document.getElementById('visitor-health-section');
        var loggedIn = this.isLoggedIn();
        if (btn) btn.style.display = loggedIn ? 'none' : 'flex';
        if (visitorLabel) visitorLabel.style.display = loggedIn ? 'none' : 'flex';
        if (visitorHealth) visitorHealth.style.display = loggedIn ? 'none' : '';
        this.updateBottomNavVisibility();
    },

    updateBottomNavVisibility() {
        var bottomNav = document.querySelector('.bottom-nav');
        if (!bottomNav) return;
        if (this.isLoggedIn()) {
            // Logged in: show all nav buttons (role-based handled by applyRoleAccess)
            bottomNav.style.display = '';
            bottomNav.querySelectorAll('.bottom-nav-btn').forEach(function(btn) {
                if (!btn.classList.contains('role-hidden')) {
                    btn.style.display = '';
                }
            });
        } else {
            // Visitor: only show home tab
            bottomNav.querySelectorAll('.bottom-nav-btn').forEach(function(btn) {
                var tab = btn.getAttribute('data-tab');
                btn.style.display = tab === 'home' ? '' : 'none';
            });
        }
    },

    // ==========================================
    // UI: Role-based Access
    // ==========================================

    applyRoleAccess() {
        var self = this;

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

        this.updateHeaderLoginButton();
    },

    // ==========================================
    // User Management (Admin) - Server API only
    // ==========================================

    async loadUsers() {
        var baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
        var response = await fetch(baseUrl + '/api/users', {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) throw new Error('โหลดรายชื่อผู้ใช้ไม่สำเร็จ');
        return await response.json();
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

    _usersPage: 1,
    _usersPageSize: 10,
    _allUsers: [],

    async renderUserList() {
        var container = document.getElementById('users-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:20px;color:#AFB1B6">กำลังโหลด...</div>';

        try {
            var users = await this.loadUsers();
            this._allUsers = users;
        } catch (e) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626">' + e.message + '</div>';
            return;
        }

        if (this._allUsers.length === 0) {
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
                document.getElementById('new-username').value = '';
                document.getElementById('new-displayname').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('new-role').value = 'user';
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
