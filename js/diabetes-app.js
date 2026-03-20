/**
 * Diabetes Tracking App - Main Controller
 * All data flows through server API (MariaDB).
 * Auth token stored in sessionStorage only.
 */

// ============================================================================
// Helper: Auth-aware fetch
// ============================================================================

function authFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};

    if (window.Auth && Auth.getToken()) {
        options.headers['Authorization'] = 'Bearer ' + Auth.getToken();
    }

    return fetch(url, options);
}

// ============================================================================
// API Client (server-only, no localStorage)
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
            console.warn('API.checkStatus: Server not available.', e.message);
            this.dbConnected = false;
            return { dbConnected: false };
        }
    },

    async getPatients() {
        const response = await authFetch(this.baseUrl + '/api/patients');
        if (!response.ok) throw new Error('Failed to fetch patients');
        return await response.json();
    },

    async getPatient(id) {
        const response = await authFetch(this.baseUrl + '/api/patients/' + encodeURIComponent(id));
        if (!response.ok) throw new Error('Failed to fetch patient');
        return await response.json();
    },

    async savePatient(data) {
        const response = await authFetch(this.baseUrl + '/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save patient');
        return await response.json();
    },

    async saveQuestionnaire(id, data) {
        const response = await authFetch(this.baseUrl + '/api/questionnaire/' + encodeURIComponent(id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save questionnaire');
        return await response.json();
    },

    async getStatsCounts() {
        try {
            const response = await fetch(this.baseUrl + '/api/stats/counts');
            if (!response.ok) throw new Error('Failed to fetch stats');
            return await response.json();
        } catch (e) {
            console.error('API.getStatsCounts error:', e.message);
            return { total: 0, experimental: 0, control: 0 };
        }
    },

    async getDashboardSummary() {
        const response = await authFetch(this.baseUrl + '/api/dashboard/summary');
        if (!response.ok) throw new Error('Failed to fetch dashboard summary');
        return await response.json();
    },

    async exportCSV() {
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
        showToast('ส่งออก CSV สำเร็จ', 'success');
    }
};

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

            navButtons.forEach(function (b) {
                b.classList.remove('active');
            });

            btn.classList.add('active');

            tabContents.forEach(function (tc) {
                if (tc.id === 'tab-' + targetTab || tc.id === targetTab || tc.getAttribute('data-tab') === targetTab) {
                    tc.classList.add('active');
                    tc.style.display = '';
                } else {
                    tc.classList.remove('active');
                    tc.style.display = 'none';
                }
            });

            if (targetTab === 'home') {
                initHome();
            } else if (targetTab === 'dtx') {
                if (window.DiabetesDTX && typeof window.DiabetesDTX.init === 'function') {
                    window.DiabetesDTX.refreshPatientList();
                }
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
            textEl.textContent = 'Server ไม่พร้อม';
        }
    }

    try {
        var summary = await API.getStatsCounts();
        var experimental = summary.experimental || 0;
        var control = summary.control || 0;
        var total = summary.totalPatients || summary.total || 0;
        var followUp = summary.followUpComplete || 0;

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
// DOMContentLoaded - App Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async function () {
    if (window.Auth) {
        Auth.initLoginForm();
        Auth.initHeaderLoginButton();

        if (Auth.isLoggedIn()) {
            await Auth.verifyToken();
        }
    }

    await initApp();
});

async function initApp() {
    showLoading();

    await API.checkStatus();

    if (window.Auth) {
        Auth.applyRoleAccess();
        Auth.updateUserMenu();
        Auth.initUserManagement();
    }

    initNavigation();
    await initHome();
    await DiabetesApp.loadAllPatients();

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
    if (window.DiabetesDTX && typeof window.DiabetesDTX.init === 'function') {
        window.DiabetesDTX.init();
    }

    hideLoading();
}

// ============================================================================
// Expose public functions on window
// ============================================================================

window.API = API;
window.authFetch = authFetch;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.initNavigation = initNavigation;
window.initHome = initHome;
window.initApp = initApp;

// ============================================================================
// DiabetesApp Facade
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

    populatePatientSelector(selector) {
        if (!selector) return;
        while (selector.options.length > 1) {
            selector.remove(1);
        }
        DiabetesApp.patients.forEach(function (patient) {
            var opt = document.createElement('option');
            opt.value = patient.patient_id || patient.id || patient.hn || '';
            opt.textContent = (patient.patient_id || patient.hn || patient.id || '?') +
                (patient.first_name ? ' - ' + patient.first_name : '') +
                (patient.study_group ? ' (' + patient.study_group + ')' : '');
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
