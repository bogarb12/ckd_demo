/**
 * Diabetes Tracking App - Main Controller
 * Handles API communication, localStorage fallback, navigation, and app initialization.
 */

// ============================================================================
// LocalDB - localStorage Fallback
// ============================================================================

const LocalDB = {
    STORAGE_KEY: 'diabetes_patients',

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('LocalDB.getAll error:', e);
            return [];
        }
    },

    get(id) {
        const patients = this.getAll();
        return patients.find(p => p.id === id || p.hn === id) || null;
    },

    save(data) {
        try {
            const patients = this.getAll();
            const existingIndex = patients.findIndex(
                p => (data.id && p.id === data.id) || (data.hn && p.hn === data.hn)
            );

            if (existingIndex >= 0) {
                patients[existingIndex] = {
                    ...patients[existingIndex],
                    ...data,
                    updatedAt: new Date().toISOString()
                };
            } else {
                data.id = data.id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                data.createdAt = new Date().toISOString();
                data.updatedAt = new Date().toISOString();
                patients.push(data);
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
            return data;
        } catch (e) {
            console.error('LocalDB.save error:', e);
            throw e;
        }
    },

    delete(id) {
        try {
            let patients = this.getAll();
            patients = patients.filter(p => p.id !== id && p.hn !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
            return true;
        } catch (e) {
            console.error('LocalDB.delete error:', e);
            return false;
        }
    },

    saveQuestionnaire(id, data) {
        try {
            const patients = this.getAll();
            const index = patients.findIndex(p => p.id === id || p.hn === id);

            if (index >= 0) {
                patients[index].questionnaire = {
                    ...patients[index].questionnaire,
                    ...data
                };
                patients[index].updatedAt = new Date().toISOString();
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
                return patients[index];
            } else {
                const newPatient = {
                    id: id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    questionnaire: data,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                patients.push(newPatient);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(patients));
                return newPatient;
            }
        } catch (e) {
            console.error('LocalDB.saveQuestionnaire error:', e);
            throw e;
        }
    },

    exportCSV() {
        const patients = this.getAll();
        if (patients.length === 0) {
            return null;
        }

        const allKeys = new Set();
        patients.forEach(function (patient) {
            _flattenKeys(patient, '', allKeys);
        });

        const sortedKeys = Array.from(allKeys).sort();
        const BOM = '\uFEFF';

        const headerRow = sortedKeys.map(function (key) {
            return '"' + key.replace(/"/g, '""') + '"';
        }).join(',');

        const dataRows = patients.map(function (patient) {
            const flat = {};
            _flattenObject(patient, '', flat);
            return sortedKeys.map(function (key) {
                const val = flat[key] !== undefined ? String(flat[key]) : '';
                return '"' + val.replace(/"/g, '""') + '"';
            }).join(',');
        });

        return BOM + headerRow + '\n' + dataRows.join('\n');
    }
};

function _flattenKeys(obj, prefix, keysSet) {
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const fullKey = prefix ? prefix + '.' + key : key;
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            _flattenKeys(val, fullKey, keysSet);
        } else {
            keysSet.add(fullKey);
        }
    }
}

function _flattenObject(obj, prefix, result) {
    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const fullKey = prefix ? prefix + '.' + key : key;
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
            _flattenObject(val, fullKey, result);
        } else if (Array.isArray(val)) {
            result[fullKey] = val.join('; ');
        } else {
            result[fullKey] = val;
        }
    }
}

// ============================================================================
// Authenticated Fetch Helper
// ============================================================================

function authFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};

    // Add auth token if available
    if (window.Auth && Auth.getToken()) {
        options.headers['Authorization'] = 'Bearer ' + Auth.getToken();
    }

    return fetch(url, options);
}

// ============================================================================
// API Client (with auth headers)
// ============================================================================

const API = {
    baseUrl: (function() {
        var path = window.location.pathname;
        var lastSlash = path.lastIndexOf('/');
        return lastSlash > 0 ? path.substring(0, lastSlash) : '';
    })(),
    dbConnected: false,

    async checkStatus() {
        try {
            const response = await fetch(this.baseUrl + '/api/status');
            if (!response.ok) throw new Error('Status check failed');
            const result = await response.json();
            this.dbConnected = !!(result && result.dbConnected);
            return result;
        } catch (e) {
            console.warn('API.checkStatus: Server not available, using localStorage fallback.', e.message);
            this.dbConnected = false;
            return { dbConnected: false };
        }
    },

    async getPatients() {
        if (!this.dbConnected) {
            return LocalDB.getAll();
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/patients');
            if (!response.ok) throw new Error('Failed to fetch patients');
            return await response.json();
        } catch (e) {
            console.error('API.getPatients error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Using local data.', 'error');
            return LocalDB.getAll();
        }
    },

    async getPatient(id) {
        if (!this.dbConnected) {
            return LocalDB.get(id);
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/patients/' + encodeURIComponent(id));
            if (!response.ok) throw new Error('Failed to fetch patient');
            return await response.json();
        } catch (e) {
            console.error('API.getPatient error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Using local data.', 'error');
            return LocalDB.get(id);
        }
    },

    async savePatient(data) {
        if (!this.dbConnected) {
            const saved = LocalDB.save(data);
            showToast('Saved locally (offline mode).', 'info');
            return saved;
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save patient');
            const result = await response.json();
            showToast('Saved successfully.', 'success');
            return result;
        } catch (e) {
            console.error('API.savePatient error, falling back to localStorage:', e.message);
            showToast('Server error. Saved locally instead.', 'error');
            return LocalDB.save(data);
        }
    },

    async saveQuestionnaire(id, data) {
        if (!this.dbConnected) {
            const saved = LocalDB.saveQuestionnaire(id, data);
            showToast('Questionnaire saved locally (offline mode).', 'info');
            return saved;
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/questionnaire/' + encodeURIComponent(id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save questionnaire');
            const result = await response.json();
            showToast('Questionnaire saved successfully.', 'success');
            return result;
        } catch (e) {
            console.error('API.saveQuestionnaire error, falling back to localStorage:', e.message);
            showToast('Server error. Questionnaire saved locally.', 'error');
            return LocalDB.saveQuestionnaire(id, data);
        }
    },

    async getStatsCounts() {
        if (!this.dbConnected) {
            return _buildLocalDashboardSummary();
        }
        try {
            const response = await fetch(this.baseUrl + '/api/stats/counts');
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (e) {
            console.error('API.getStatsCounts error, falling back to localStorage:', e.message);
            return _buildLocalDashboardSummary();
        }
    },

    async getDashboardSummary() {
        if (!this.dbConnected) {
            return _buildLocalDashboardSummary();
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/dashboard/summary');
            if (!response.ok) throw new Error('Failed to fetch dashboard summary');
            return await response.json();
        } catch (e) {
            console.error('API.getDashboardSummary error, falling back to localStorage:', e.message);
            showToast('Cannot reach server. Showing local data.', 'error');
            return _buildLocalDashboardSummary();
        }
    },

    async exportCSV() {
        if (!this.dbConnected) {
            return _downloadLocalCSV();
        }
        try {
            const response = await authFetch(this.baseUrl + '/api/export/csv');
            if (!response.ok) throw new Error('Failed to export CSV');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diabetes_patients_export.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('CSV exported successfully.', 'success');
        } catch (e) {
            console.error('API.exportCSV error, falling back to localStorage:', e.message);
            showToast('Server error. Exporting from local data.', 'error');
            return _downloadLocalCSV();
        }
    }
};

function _buildLocalDashboardSummary() {
    const patients = LocalDB.getAll();
    const total = patients.length;
    const experimental = patients.filter(function (p) {
        return p.group === 'experimental' || p.group === 'exp';
    }).length;
    const control = patients.filter(function (p) {
        return p.group === 'control' || p.group === 'ctrl';
    }).length;

    return {
        total: total,
        experimental: experimental,
        control: control,
        source: 'localStorage'
    };
}

function _downloadLocalCSV() {
    const csvContent = LocalDB.exportCSV();
    if (!csvContent) {
        showToast('No data to export.', 'info');
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diabetes_patients_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported from local data.', 'success');
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, type) {
    type = type || 'info';

    var colorMap = {
        success: '#166534',
        error: '#991b1b',
        info: '#2A86FF'
    };

    var bgColor = colorMap[type] || colorMap.info;

    var toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.textContent = message;
    toast.style.cssText = [
        'position: fixed',
        'bottom: 80px',
        'left: 50%',
        'transform: translateX(-50%)',
        'background-color: ' + bgColor,
        'color: #fff',
        'padding: 12px 24px',
        'border-radius: 8px',
        'font-family: Athiti, sans-serif',
        'font-size: 14px',
        'z-index: 10000',
        'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
        'opacity: 0',
        'transition: opacity 0.3s ease',
        'max-width: 90%',
        'text-align: center'
    ].join(';');

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
        toast.style.opacity = '1';
    });

    setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================================================
// Loading Overlay
// ============================================================================

function showLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        return;
    }

    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'background: rgba(255,255,255,0.8)',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'z-index: 9999'
    ].join(';');

    var spinner = document.createElement('div');
    spinner.style.cssText = [
        'width: 48px',
        'height: 48px',
        'border: 4px solid #e0e0e0',
        'border-top-color: #2A86FF',
        'border-radius: 50%',
        'animation: spin 0.8s linear infinite'
    ].join(';');

    if (!document.getElementById('loading-spinner-style')) {
        var style = document.createElement('style');
        style.id = 'loading-spinner-style';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
}

function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================================================
// Tab Navigation (role-aware)
// ============================================================================

function initNavigation() {
    var navButtons = document.querySelectorAll('.bottom-nav-btn');
    var tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetTab = btn.getAttribute('data-tab');

            // Check if this tab requires admin login
            var requiredRole = btn.getAttribute('data-role');
            if (requiredRole && window.Auth) {
                var hasAccess = false;
                if (requiredRole === 'admin') hasAccess = Auth.isAdmin();
                else if (requiredRole === 'staff') hasAccess = Auth.isStaff();
                else if (requiredRole === 'researcher') hasAccess = Auth.isResearcher();
                if (!hasAccess) {
                    Auth.showLoginModal();
                    return;
                }
            }

            // Remove active class from all nav buttons
            navButtons.forEach(function (b) {
                b.classList.remove('active');
            });

            // Add active class to clicked button
            btn.classList.add('active');

            // Hide all tab contents, then show the matching one
            tabContents.forEach(function (tc) {
                if (tc.id === 'tab-' + targetTab || tc.id === targetTab || tc.getAttribute('data-tab') === targetTab) {
                    tc.classList.add('active');
                    tc.style.display = '';
                } else {
                    tc.classList.remove('active');
                    tc.style.display = 'none';
                }
            });

            // Call tab-specific init functions
            if (targetTab === 'home') {
                initHome();
            } else if (targetTab === 'dashboard') {
                if (window.DiabetesDashboard && typeof window.DiabetesDashboard.init === 'function') {
                    window.DiabetesDashboard.init();
                }
            } else if (targetTab === 'users') {
                if (window.Auth) {
                    Auth.renderUserList();
                }
            }
        });
    });
}

// ============================================================================
// Home Tab Init
// ============================================================================

var homePatientChart = null;

async function initHome() {
    var dotEl = document.getElementById('db-dot');
    var textEl = document.getElementById('db-text');
    if (dotEl && textEl) {
        if (API.dbConnected) {
            dotEl.style.background = '#00e272';
            textEl.textContent = 'Database Connected';
        } else {
            dotEl.style.background = '#fe6a35';
            textEl.textContent = 'Offline (Local Storage)';
        }
    }

    try {
        var summary = await API.getStatsCounts();
        var experimental = summary.experimental || 0;
        var control = summary.control || 0;
        var total = summary.totalPatients || summary.total || 0;
        var followUp = summary.followUpComplete || 0;

        // Render doughnut chart (admin-only section)
        var canvas = document.getElementById('home-patient-chart');
        if (canvas && typeof Chart !== 'undefined') {
            if (homePatientChart) homePatientChart.destroy();

            var colors = ['rgba(44,175,254,0.85)', 'rgba(254,106,53,0.85)', 'rgba(0,226,114,0.85)'];
            var labels = ['กลุ่มทดลอง', 'กลุ่มควบคุม', 'ติดตามครบ'];
            var values = [experimental, control, followUp];

            homePatientChart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    return ctx.label + ': ' + ctx.parsed + ' คน';
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'centerText',
                    afterDraw: function(chart) {
                        var ctx = chart.ctx;
                        var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                        var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.font = 'bold 1.5rem Athiti, sans-serif';
                        ctx.fillStyle = '#1a1a2e';
                        ctx.fillText(total, centerX, centerY - 8);
                        ctx.font = '0.65rem Athiti, sans-serif';
                        ctx.fillStyle = '#61646B';
                        ctx.fillText('ทั้งหมด', centerX, centerY + 14);
                        ctx.restore();
                    }
                }]
            });

            // Build legend
            var legendEl = document.getElementById('home-chart-legend');
            if (legendEl) {
                legendEl.innerHTML = labels.map(function(label, i) {
                    return '<div class="home-legend-item">' +
                        '<span class="home-legend-dot" style="background:' + colors[i] + '"></span>' +
                        '<span class="home-legend-label">' + label + '</span>' +
                        '<span class="home-legend-value" style="color:' + colors[i] + '">' + values[i] + '</span>' +
                        '</div>';
                }).join('');
            }
        }
    } catch (e) {
        console.error('initHome error:', e);
    }
}

// ============================================================================
// DOMContentLoaded - App Initialization (Guest-first, no login required)
// ============================================================================

document.addEventListener('DOMContentLoaded', async function () {
    // Initialize auth module (login form, header button, etc.)
    if (window.Auth) {
        Auth.initLoginForm();
        Auth.initHeaderLoginButton();

        // If already logged in, verify token silently
        if (Auth.isLoggedIn()) {
            await Auth.verifyToken();
        }
    }

    // Always initialize the app (guest mode by default)
    await initApp();
});

async function initApp() {
    showLoading();

    await API.checkStatus();

    // Apply role-based visibility
    if (window.Auth) {
        Auth.applyRoleAccess();
        Auth.updateUserMenu();
        Auth.initUserManagement();
    }

    initNavigation();
    await initHome();

    // Initialize other modules if they exist
    if (window.DiabetesForm && typeof window.DiabetesForm.init === 'function') {
        window.DiabetesForm.init();
    }
    if (window.DiabetesQuestionnaire && typeof window.DiabetesQuestionnaire.init === 'function') {
        window.DiabetesQuestionnaire.init();
    }
    if (window.DiabetesEducation && typeof window.DiabetesEducation.init === 'function') {
        window.DiabetesEducation.init();
    }
    if (window.DailyTracking && typeof window.DailyTracking.init === 'function') {
        window.DailyTracking.init();
    }
    if (window.LineBotGenerator && typeof window.LineBotGenerator.init === 'function') {
        window.LineBotGenerator.init();
    }

    hideLoading();
}

// ============================================================================
// Expose all public functions and objects on window for global access
// ============================================================================

window.API = API;
window.LocalDB = LocalDB;
window.authFetch = authFetch;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.initNavigation = initNavigation;
window.initHome = initHome;
window.initApp = initApp;

// ============================================================================
// DiabetesApp Facade
// Bridges legacy DiabetesApp references in form/questionnaire/dashboard modules
// to the actual API, LocalDB, and utility functions.
// ============================================================================

const DiabetesApp = {
    get dbConnected() {
        return API.dbConnected;
    },

    patients: [],

    showLoading: showLoading,
    hideLoading: hideLoading,
    showToast: showToast,

    async savePatient(data) {
        return API.savePatient(data);
    },

    async loadPatient(id) {
        return API.getPatient(id);
    },

    async loadAllPatients() {
        const patients = await API.getPatients();
        DiabetesApp.patients = patients || [];
        return DiabetesApp.patients;
    },

    loadAllFromLocal() {
        const patients = LocalDB.getAll();
        DiabetesApp.patients = patients || [];
        return DiabetesApp.patients;
    },

    loadFromLocal(id) {
        return LocalDB.get(id);
    },

    populatePatientSelector(selector) {
        if (!selector) return;
        // Clear existing options except the first placeholder
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        DiabetesApp.patients.forEach(function (patient) {
            var opt = document.createElement('option');
            opt.value = patient.id || patient.hn || '';
            opt.textContent = (patient.hn || patient.id || '?') +
                (patient.name ? ' - ' + patient.name : '') +
                (patient.group ? ' (' + patient.group + ')' : '');
            selector.appendChild(opt);
        });
    },

    async apiGet(url) {
        const response = await authFetch(API.baseUrl + url);
        if (!response.ok) throw new Error('API GET failed: ' + url);
        return response.json();
    },

    async apiPost(url, data) {
        const response = await authFetch(API.baseUrl + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('API POST failed: ' + url);
        return response.json();
    }
};

window.DiabetesApp = DiabetesApp;
